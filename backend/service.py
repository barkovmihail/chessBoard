from time import time_ns
from uuid import uuid4

from sqlalchemy import insert, select, update

from .db import games, moves, receipts
from .domain import GameError, replay, snapshot


class Games:
    def __init__(self, engine, now_ms=None):
        self.engine = engine
        self.now_ms = now_ms or (lambda: time_ns() // 1_000_000)

    def create(self, owner, online=False, control=None):
        game_id = uuid4().hex
        with self.engine.begin() as db:
            clock = {}
            if control:
                minutes, increment = control
                base_ms = minutes * 60000
                clock = dict(base_minutes=minutes, increment_seconds=increment, white_ms=base_ms,
                             black_ms=base_ms, deadline_ms=None if online else self.now_ms() + base_ms)
            db.execute(insert(games).values(id=game_id, owner=owner, version=0, online=online, **clock))
        return self.get(game_id, owner)

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
        return self.get(game_id, player)

    def _view(self, game, history, player):
        view = snapshot(game["id"], history)
        view["side"] = ("white" if game["owner"] == player else "black") if game["online"] else "both"
        view["waiting"] = bool(game["online"] and not game["guest"])
        view.update(version=game["version"], draw_offer=game["draw_offer"])
        if game["result"]:
            view.update(result=game["result"], reason=game["reason"], legal=[])
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

    def _flag(self, db, game, history):
        board, _ = replay(history)
        winner = not board.turn
        result = ("1-0" if winner else "0-1") if not board.has_insufficient_material(winner) else "1/2-1/2"
        changes = {"result": result, "reason": "timeout", "deadline_ms": None, "draw_offer": None,
                   "white_ms" if board.turn else "black_ms": 0, "version": game["version"] + 1}
        db.execute(update(games).where(games.c.id == game["id"]).values(**changes))
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
            if view["result"]:
                raise GameError("game_finished", 409)
            if view["waiting"]:
                raise GameError("not_your_turn", 403)
            side = view["side"]
            changes = {"version": version + 1}
            if command in ("resign", "offer", "accept", "decline"):
                if side == "both":
                    raise GameError("online_only", 409)
                changes.update(self._action(command, side, view["draw_offer"]))
            else:
                if side not in ("both", view["turn"]):
                    raise GameError("not_your_turn", 403)
                if command not in view["legal"]:
                    raise GameError("illegal_move", 422)
                history.append(command)
                db.execute(insert(moves).values(game_id=game_id, ply=len(history), uci=command,
                                                command_id=command_id))
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
                    outcome = replay(history)[0].outcome()
                    if outcome:
                        changes.update(result=outcome.result(), reason=outcome.termination.name.lower())
                if changes.get("result"):
                    changes["deadline_ms"] = None
                    if not is_move:
                        changes[moving] = remaining
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
