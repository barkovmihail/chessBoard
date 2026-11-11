from time import time_ns

from sqlalchemy import func, select
from sqlalchemy.dialects.sqlite import insert

from .db import puzzle_attempts as attempts
from .domain import GameError


class PuzzleAttempts:
    def __init__(self, engine):
        self.engine = engine

    def record(self, player, attempt_id, puzzle, mistakes, solved):
        entry = insert(attempts).values(player=player, id=attempt_id, puzzle=puzzle,
            started=time_ns() // 1_000_000, mistakes=mistakes, solved=solved)
        with self.engine.begin() as db:
            result = db.execute(entry.on_conflict_do_update(index_elements=["player", "id"], set_={
                "mistakes": func.max(attempts.c.mistakes, mistakes),
                "solved": attempts.c.solved | solved,
            }, where=attempts.c.puzzle == puzzle))
            if result.rowcount != 1:
                raise GameError("attempt_conflict", 409)

    def history(self, player, offset):
        with self.engine.connect() as db:
            rows = db.execute(select(attempts.c.id, attempts.c.puzzle, attempts.c.started,
                attempts.c.mistakes, attempts.c.solved).where(attempts.c.player == player)
                .order_by(attempts.c.started.desc(), attempts.c.id.desc()).limit(21).offset(offset)).mappings().all()
        return {"items": [dict(row) for row in rows[:20]], "more": len(rows) > 20}
