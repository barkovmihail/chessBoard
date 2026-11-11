from uuid import uuid4

from sqlalchemy import insert, select, update

from .db import games, moves
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
            game, rows = self._load(db, game_id, owner)
            return self._view(game, [row["uci"] for row in rows], owner)

    def move(self, game_id, owner, uci, version, command_id):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            game, rows = self._load(db, game_id, owner)
            history = [row["uci"] for row in rows]
            for row in rows:
                if row["command_id"] == command_id:
                    if game["online"] and (row["ply"] % 2 == 1) != (owner == game["owner"]):
                        raise GameError("command_conflict", 409)
                    if row["uci"] != uci or row["ply"] != version + 1:
                        raise GameError("command_conflict", 409)
                    return self._view(game, history[:row["ply"]], owner)
            if game["version"] != version:
                raise GameError("stale_version", 409)
            view = self._view(game, history, owner)
            if view["waiting"] or view["side"] not in ("both", view["turn"]):
                raise GameError("not_your_turn", 403)
            if uci not in view["legal"]:
                raise GameError("illegal_move", 422)
            db.execute(update(games).where(games.c.id == game_id, games.c.version == version)
                       .values(version=version + 1))
            db.execute(insert(moves).values(game_id=game_id, ply=version + 1,
                       uci=uci, command_id=command_id))
            return self._view(game, [*history, uci], owner)
