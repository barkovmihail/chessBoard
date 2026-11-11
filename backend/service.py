from time import time_ns
from uuid import uuid4

from sqlalchemy import case, func, insert, select, update

from .computer import NAMES, SEATS
from .db import accounts, games, moves, receipts
from .notifications import notify_finish, notify_turn
from .ratings import POOLS, rating, record_result
from .domain import GameError, display_fen, replay, review960, snapshot


def opponent_name():
    return case({seat: NAMES[name] for name, seat in SEATS.items()},
                value=games.c.guest, else_=accounts.c.name).label("opponent")


class Games:
    def __init__(self, engine, now_ms=None):
        self.engine = engine
        self.now_ms = now_ms or (lambda: time_ns() // 1_000_000)

    def create(self, owner, online=False, control=None, engine_level=None, engine_name="lc0", public=False, chess960=None):
        with self.engine.begin() as db:
            game_id = self.insert_game(db, owner, online or bool(engine_level), control,
                                       guest=SEATS[engine_name] if engine_level else None, engine_level=engine_level, chess960=chess960)
            if public:
                db.execute(update(games).where(games.c.id == game_id).values(watch_key=uuid4().hex))
        return self.get(game_id, owner)

    def insert_game(self, db, owner, online, control, guest=None, previous_game=None, rated=False, engine_level=None, chess960=None):
        game_id = uuid4().hex
        clock = {}
        if control:
            minutes, increment = control
            base_ms = minutes * 60000
            clock = dict(base_minutes=minutes, increment_seconds=increment, white_ms=base_ms,
                         black_ms=base_ms, deadline_ms=None if online and not guest else self.now_ms() + base_ms)
        db.execute(insert(games).values(id=game_id, owner=owner, version=0, online=online, guest=guest,
                                        engine_level=engine_level, chess960=chess960, previous_game=previous_game, rated=rated, **clock))
        if online and guest:
            notify_turn(db, owner, game_id, 0, self.now_ms())
        return game_id

    def ratings(self, player):
        with self.engine.connect() as db:
            return {pool: rating(db, player, pool) for pool in POOLS}

    def archive(self, player, offset, limit):
        with self.engine.connect() as db:
            rows = db.execute(select(games.c.id, games.c.owner, games.c.online, games.c.finished_ms,
                games.c.base_minutes, games.c.increment_seconds, games.c.result, games.c.reason, opponent_name())
                .outerjoin(accounts, accounts.c.player == case((games.c.owner == player, games.c.guest), else_=games.c.owner))
                .where(games.c.result.is_not(None), (games.c.owner == player) | (games.c.guest == player))
                .order_by(games.c.finished_ms.desc(), games.c.id.desc()).offset(offset).limit(limit + 1)).mappings().all()
            items = []
            for row in rows[:limit]:
                item = dict(row)
                owner, online = item.pop("owner"), item.pop("online")
                item["side"] = ("white" if owner == player else "black") if online else "both"
                items.append(item)
            return {"items": items, "next_offset": offset + limit if len(rows) > limit else None}

    def active_games(self, player, offset, limit):
        ply = select(func.max(moves.c.ply)).where(moves.c.game_id == games.c.id).scalar_subquery()
        rival = case((games.c.owner == player, games.c.guest), else_=games.c.owner)
        query = (select(games.c.id, games.c.online, games.c.base_minutes, games.c.increment_seconds,
                        (games.c.owner == player).label("white"), games.c.guest.is_(None).label("empty_seat"),
                        ply.label("ply"), opponent_name())
                 .outerjoin(accounts, accounts.c.player == rival)
                 .where(games.c.result.is_(None), (games.c.owner == player) | (games.c.guest == player))
                 .order_by(games.c.id).offset(offset).limit(limit + 1))
        with self.engine.connect() as db:
            rows = db.execute(query).mappings().all()
        items = []
        for row in rows[:limit]:
            item = dict(row)
            white, online = item.pop("white"), item.pop("online")
            item["side"] = ("white" if white else "black") if online else "both"
            item["waiting"] = item.pop("empty_seat") and online
            item["turn"] = "black" if (item.pop("ply") or 0) % 2 else "white"
            items.append(item)
        return {"items": items, "next_offset": offset + limit if len(rows) > limit else None}

    def invitation(self, game_id):
        with self.engine.connect() as db:
            control = db.execute(select(games.c.base_minutes, games.c.increment_seconds)
                                 .where(games.c.id == game_id, games.c.online.is_(True))).mappings().first()
            if not control:
                raise GameError("game_unavailable", 404)
            return dict(control)

    def join(self, game_id, player):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            game = db.execute(select(games).where(games.c.id == game_id)).mappings().first()
            if not game or not game["online"]:
                raise GameError("game_unavailable", 404)
            if player not in (game["owner"], game["guest"]):
                if game["guest"] is not None:
                    raise GameError("seat_taken", 409)
                db.execute(update(games).where(games.c.id == game_id).values(guest=player, deadline_ms=(self.now_ms() + game["white_ms"]
                                      if game["base_minutes"] else None)))
                notify_turn(db, game["owner"], game_id, 0, self.now_ms())
        return self.get(game_id, player)

    def _view(self, game, history, player):
        view = snapshot(game["id"], history, game["chess960"])
        view["chess960"] = game["chess960"]
        view["side"] = ("white" if game["owner"] == player else "black") if game["online"] else "both"
        view["waiting"] = bool(game["online"] and not game["guest"])
        view["engine_name"] = game["guest"].split(":")[1] if game["engine_level"] else None
        view["engine_level"] = game["engine_level"]
        view["arena_id"] = game["arena_id"]
        view["watch_key"] = game["watch_key"]
        view.update(rated=game["rated"], version=game["version"], draw_offer=game["draw_offer"])
        for key in ("previous_game", "next_game", "rematch_offer"):
            view[key] = game[key]
        if game["result"]:
            if game["chess960"] is not None:
                view["review960"] = review960(game["chess960"], history, game["result"])
            view.update(result=game["result"], reason=game["reason"], legal=[], claims={})
        if game["base_minutes"]:
            view["clock"] = {key: game[key] for key in (
                "base_minutes", "increment_seconds", "white_ms", "black_ms", "deadline_ms")}
            view["clock"]["server_ms"] = self.now_ms()
        return view

    def _load(self, db, game_id, owner):
        game = db.execute(select(games).where(games.c.id == game_id)).mappings().first()
        if not game or not owner or owner not in (game["owner"], game["guest"]):
            raise GameError("game_unavailable", 404)
        rows = db.execute(select(moves).where(moves.c.game_id == game_id)
                          .order_by(moves.c.ply)).mappings().all()
        return game, rows

    def get(self, game_id, owner):
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            game, rows = self._load(db, game_id, owner)
            return self._view(game, [row["uci"] for row in rows], owner)

    def set_visibility(self, game_id, player, version, public):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            game, _ = self._load(db, game_id, player)
            if bool(game["watch_key"]) != public:
                if game["version"] != version:
                    raise GameError("stale_version", 409)
                db.execute(update(games).where(games.c.id == game_id).values(
                    watch_key=uuid4().hex if public else None, version=version + 1))
        return self.get(game_id, player)

    def watch(self, key, version):
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            game = db.execute(select(games.c.id, games.c.version, games.c.result, games.c.reason,
                                     games.c.online, games.c.guest, games.c.chess960).where(games.c.watch_key == key)).one_or_none()
            if not game:
                raise GameError("game_unavailable", 404)
            if version == game.version:
                return None
            history = db.scalars(select(moves.c.uci).where(moves.c.game_id == game.id).order_by(moves.c.ply)).all()
            extra = {}
            if game.chess960 is not None:
                board, notation = replay(history, game.chess960)
                extra = {"fen": display_fen(board), "notation": notation}
            return {**extra, "moves": history, "version": game.version, "result": game.result, "reason": game.reason,
                    "waiting": bool(game.online and not game.guest)}

    def _flag(self, db, game, history):
        board, _ = replay(history, game["chess960"])
        winner = not board.turn
        result = ("1-0" if winner else "0-1") if not board.has_insufficient_material(winner) else "1/2-1/2"
        changes = {"result": result, "reason": "timeout", "finished_ms": self.now_ms(), "deadline_ms": None, "draw_offer": None,
                   "white_ms" if board.turn else "black_ms": 0, "version": game["version"] + 1}
        db.execute(update(games).where(games.c.id == game["id"]).values(**changes))
        notify_finish(db, game, changes["finished_ms"])
        record_result(db, game, result)
        return dict(game, **changes)

    def expire_due(self):
        now = self.now_ms()
        with self.engine.connect() as db:
            due = db.execute(select(games.c.id).where(games.c.deadline_ms <= now)).scalars().all()
        changed = []
        for game_id in due:
            with self.engine.begin() as db:
                db.exec_driver_sql("BEGIN IMMEDIATE")
                game = db.execute(select(games).where(games.c.id == game_id,
                                  games.c.deadline_ms <= self.now_ms())).mappings().first()
                if game:
                    history = db.execute(select(moves.c.uci).where(moves.c.game_id == game_id)
                                         .order_by(moves.c.ply)).scalars().all()
                    self._flag(db, game, history)
                    changed.append(game_id)
        return changed

    def apply(self, game_id, owner, command, version, command_id):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            game, rows = self._load(db, game_id, owner)
            history = [row["uci"] for row in rows]
            receipt = db.execute(select(receipts).where(receipts.c.game_id == game_id,
                                 receipts.c.command_id == command_id)).mappings().first()
            if receipt:
                if (receipt["player"], receipt["command"], receipt["version"]) != (owner, command, version):
                    raise GameError("command_conflict", 409)
                response = receipt["response"]
                if response.get("clock"):
                    response["clock"]["server_ms"] = self.now_ms()
                return response
            # Before revision 003 every command was a move and version equalled ply.
            for row in rows:
                if row["command_id"] == command_id:
                    if (row["uci"] != command or row["ply"] != version + 1 or
                            (game["online"] and (row["ply"] % 2 == 1) != (owner == game["owner"]))):
                        raise GameError("command_conflict", 409)
                    legacy = dict(game, version=row["ply"], result=None, reason=None, draw_offer=None)
                    return self._view(legacy, history[:row["ply"]], owner)
            now = self.now_ms()
            deadline = game["deadline_ms"]
            if deadline is not None and now >= deadline:
                return self._view(self._flag(db, game, history), history, owner)
            if game["version"] != version:
                raise GameError("stale_version", 409)
            view = self._view(game, history, owner)
            if view["result"] and command != "rematch":
                raise GameError("game_finished", 409)
            if view["waiting"]:
                raise GameError("not_your_turn", 403)
            side = view["side"]
            changes = {"version": version + 1}
            if game["engine_level"] and command in ("rematch", "offer", "accept", "decline"):
                raise GameError("action_unavailable", 409)
            if command == "rematch":
                if not view["result"] or side == "both" or game["next_game"] or game["rematch_offer"] == side:
                    raise GameError("rematch_unavailable", 409)
                if game["rematch_offer"]:
                    control = (game["base_minutes"], game["increment_seconds"]) if game["base_minutes"] else None
                    changes["next_game"] = self.insert_game(db, game["guest"], True, control, game["owner"], game_id, rated=game["rated"], chess960=game["chess960"])
                    changes["rematch_offer"] = None
                else:
                    changes["rematch_offer"] = side
            elif command in ("resign", "offer", "accept", "decline"):
                if side == "both":
                    raise GameError("online_only", 409)
                changes.update(self._action(command, side, view["draw_offer"]))
            elif command == "claim" or command.startswith("claim:"):
                if side not in ("both", view["turn"]):
                    raise GameError("not_your_turn", 403)
                reason = view["claims"].get(command)
                if not reason:
                    raise GameError("invalid_draw_claim", 422)
                changes.update(result="1/2-1/2", reason=reason, draw_offer=None)
            else:
                if side not in ("both", view["turn"]):
                    raise GameError("not_your_turn", 403)
                if command not in view["legal"]:
                    raise GameError("illegal_move", 422)
                elapsed_ms = None
                if deadline is not None:
                    starting_ms = game[view["turn"] + "_ms"]
                    elapsed_ms = max(0, starting_ms - (deadline - now))
                history.append(command)
                db.execute(insert(moves).values(game_id=game_id, ply=len(history), uci=command,
                                                command_id=command_id, elapsed_ms=elapsed_ms))
                outcome = replay(history, game["chess960"])[0].outcome()
                if outcome:
                    changes.update(result=outcome.result(), reason=outcome.termination.name.lower())
                if view["draw_offer"] != side:
                    changes["draw_offer"] = None
            if deadline is not None:
                moving = view["turn"] + "_ms"
                remaining = deadline - now
                is_move = len(history) > len(rows)
                if is_move:
                    changes[moving] = remaining + game["increment_seconds"] * 1000
                    opponent = "black_ms" if moving == "white_ms" else "white_ms"
                    changes["deadline_ms"] = now + game[opponent]
                if changes.get("result"):
                    changes["deadline_ms"] = None
                    if not is_move:
                        changes[moving] = remaining
            if changes.get("result"):
                changes["finished_ms"] = now
                notify_finish(db, game, now)
                record_result(db, game, changes["result"])
            elif game["online"] and len(history) > len(rows):
                next_player = game["guest"] if view["turn"] == "white" else game["owner"]
                notify_turn(db, next_player, game_id, len(history), now)
            db.execute(update(games).where(games.c.id == game_id, games.c.version == version).values(**changes))
            result = self._view(dict(game, **changes), history, owner)
            db.execute(insert(receipts).values(game_id=game_id, command_id=command_id, player=owner,
                                               command=command, version=version, response=result))
            return result

    @staticmethod
    def _action(action, side, offer):
        if action == "resign":
            return {"reason": "resignation", "result": "0-1" if side == "white" else "1-0", "draw_offer": None}
        if action == "offer" and offer is None:
            return {"draw_offer": side}
        if offer and offer != side:
            if action == "accept":
                return {"result": "1/2-1/2", "reason": "agreement", "draw_offer": None}
            if action == "decline":
                return {"draw_offer": None}
        raise GameError("invalid_draw_offer", 409)
