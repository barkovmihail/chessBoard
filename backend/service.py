from uuid import uuid4

from sqlalchemy import insert, select, update

from .db import games, moves, receipts
from .domain import GameError, snapshot


class Games:
    def __init__(self, engine):
        self.engine = engine

    def create(self, owner, online=False):
        game_id = uuid4().hex
        with self.engine.begin() as db:
            db.execute(insert(games).values(id=game_id, owner=owner, version=0, online=online))
        return self.get(game_id, owner)

    def join(self, game_id, player):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            game = db.execute(select(games).where(games.c.id == game_id)).mappings().first()
            if not game or not game["online"]:
                raise GameError("game_unavailable", 404)
            if player not in (game["owner"], game["guest"]):
                if game["guest"] is not None:
                    raise GameError("seat_taken", 409)
                db.execute(update(games).where(games.c.id == game_id).values(guest=player))
        return self.get(game_id, player)

    def _view(self, game, history, player):
        view = snapshot(game["id"], history)
        view["side"] = ("white" if game["owner"] == player else "black") if game["online"] else "both"
        view["waiting"] = bool(game["online"] and not game["guest"])
        view.update(version=game["version"], draw_offer=game["draw_offer"])
        if game["result"]:
            view.update(result=game["result"], reason=game["reason"], legal=[])
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
                return receipt["response"]
            # Before revision 003 every command was a move and version equalled ply.
            for row in rows:
                if row["command_id"] == command_id:
                    if (row["uci"] != command or row["ply"] != version + 1 or
                            (game["online"] and (row["ply"] % 2 == 1) != (owner == game["owner"]))):
                        raise GameError("command_conflict", 409)
                    legacy = dict(game, version=row["ply"], result=None, reason=None, draw_offer=None)
                    return self._view(legacy, history[:row["ply"]], owner)
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
