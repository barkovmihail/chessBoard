from time import time_ns

from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert

from .db import accounts, arena_members, arenas
from .domain import GameError


class Arenas:
    def __init__(self, games):
        self.games = games
        self.engine = games.engine

    def create(self, player, arena_id, name):
        name = name.strip()
        if not name:
            raise GameError("empty_name", 422)
        with self.engine.begin() as db:
            result = db.execute(insert(arenas).values(id=arena_id, name=name, owner=player,
                created=time_ns() // 1_000_000).on_conflict_do_nothing())
            if result.rowcount:
                db.execute(insert(arena_members).values(arena=arena_id, player=player))
            else:
                row = db.execute(select(arenas.c.owner, arenas.c.name).where(arenas.c.id == arena_id)).one()
                if tuple(row) != (player, name):
                    raise GameError("arena_conflict", 409)
        return {"id": arena_id}

    def listing(self, offset):
        with self.engine.connect() as db:
            rows = db.execute(select(arenas.c.id, arenas.c.name).order_by(arenas.c.created.desc(), arenas.c.id)
                              .offset(offset).limit(21)).mappings().all()
        return {"items": [dict(row) for row in rows[:20]], "more": len(rows) > 20}

    def view(self, arena_id, player):
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            row = db.execute(select(arenas).where(arenas.c.id == arena_id)).mappings().first()
            if not row:
                raise GameError("arena_missing", 404)
            entrants = db.execute(select(accounts.c.name, accounts.c.player)
                .join(arena_members, arena_members.c.player == accounts.c.player)
                .where(arena_members.c.arena == arena_id).order_by(accounts.c.name)).all()
            return {"name": row["name"], "owner": row["owner"] == player, "signed_in": bool(player),
                    "joined": any(user == player for _, user in entrants), "players": [name for name, _ in entrants]}

    def register(self, arena_id, player, join):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            if not db.scalar(select(arenas.c.id).where(arenas.c.id == arena_id)):
                raise GameError("arena_missing", 404)
            if join:
                db.execute(insert(arena_members).values(arena=arena_id, player=player).on_conflict_do_nothing())
            else:
                db.execute(delete(arena_members).where(arena_members.c.arena == arena_id, arena_members.c.player == player))
        return {"ok": True}
