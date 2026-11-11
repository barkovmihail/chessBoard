from uuid import uuid4

from sqlalchemy import insert, select, update

from .db import games, moves
from .domain import GameError, snapshot


class Games:
    def __init__(self, engine):
        self.engine = engine

    def create(self, owner):
        game_id = uuid4().hex
        with self.engine.begin() as db:
            db.execute(insert(games).values(id=game_id, owner=owner, version=0))
        return snapshot(game_id, [])

    def _load(self, db, game_id, owner):
        game = db.execute(select(games).where(games.c.id == game_id)).mappings().first()
        if not game or game["owner"] != owner:
            raise GameError("game_unavailable", 404)
        rows = db.execute(select(moves).where(moves.c.game_id == game_id)
                          .order_by(moves.c.ply)).mappings().all()
        return game, rows

    def get(self, game_id, owner):
        with self.engine.connect() as db:
            _, rows = self._load(db, game_id, owner)
            return snapshot(game_id, [row["uci"] for row in rows])

    def move(self, game_id, owner, uci, version, command_id):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            game, rows = self._load(db, game_id, owner)
            history = [row["uci"] for row in rows]
            for row in rows:
                if row["command_id"] == command_id:
                    if row["uci"] != uci or row["ply"] != version + 1:
                        raise GameError("command_conflict", 409)
                    return snapshot(game_id, history[:row["ply"]])
            if game["version"] != version:
                raise GameError("stale_version", 409)
            if uci not in snapshot(game_id, history)["legal"]:
                raise GameError("illegal_move", 422)
            db.execute(update(games).where(games.c.id == game_id, games.c.version == version)
                       .values(version=version + 1))
            db.execute(insert(moves).values(game_id=game_id, ply=version + 1,
                       uci=uci, command_id=command_id))
            return snapshot(game_id, [*history, uci])
