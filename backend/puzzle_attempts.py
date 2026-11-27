from time import time_ns

from sqlalchemy import case, func, select
from sqlalchemy.dialects.sqlite import insert

from .db import puzzle_attempts as attempts
from .domain import GameError
from .puzzles import themes_for_ids
from .packed_puzzles import THEMES


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

    def progress(self, player, days, catalogue):
        a = attempts.c
        ranked = select(a.puzzle, a.started, a.mistakes, a.solved, func.row_number().over(
            partition_by=a.puzzle, order_by=(a.started, a.id)).label("number")).where(a.player == player).subquery()
        r = ranked.c
        since = time_ns() // 1_000_000 - days * 86_400_000
        query = select(r.puzzle, func.max(r.solved).label("solved"), func.sum(r.mistakes).label("mistakes"),
                       func.max(case(((r.number == 1) & r.solved & (r.mistakes == 0), 1), else_=0)).label("first")
                       ).where(r.started >= since).group_by(r.puzzle)
        with self.engine.connect() as db:
            rows = {row.puzzle: row for row in db.execute(query)}
        result = {"practiced": len(rows), "solved": sum(row.solved for row in rows.values()),
                  "first": sum(row.first for row in rows.values()), "themes": {}}
        if rows and catalogue.is_file():
            for puzzle_id, labels in themes_for_ids(catalogue, rows):
                row = rows[puzzle_id]
                for theme in THEMES.intersection(labels.split()):
                    stats = result["themes"].setdefault(theme, {"solved": 0, "mistakes": 0})
                    stats["solved"] += int(row.solved)
                    stats["mistakes"] += row.mistakes
        return result
