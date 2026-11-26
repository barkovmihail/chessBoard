from time import time

import chess
from sqlalchemy import case, func, select, update
from sqlalchemy.dialects.sqlite import insert

from .db import opening_positions, study_chapters
from .domain import GameError


def save_position(engine, player, position):
    try:
        board = chess.Board(position["fen"])
        if not board.is_valid() or board.turn != (position["side"] == "w"):
            raise ValueError()
        board.parse_uci(position["expected"])
    except ValueError as exc:
        raise GameError("invalid_opening_position", 422) from exc

    with engine.begin() as db:
        db.execute(insert(opening_positions).values(**position, player=player).on_conflict_do_nothing())


def review_position(engine, player, offset):
    positions = opening_positions.c
    query = select(positions.chapter, positions.line, positions.ply, positions.fen, positions.side,
                   positions.expected, positions.due_at, study_chapters.c.name.label("chapter_name")).select_from(
        opening_positions.outerjoin(study_chapters, positions.chapter == study_chapters.c.id)
    ).where(positions.player == player, positions.due_at <= int(time())).order_by(
        positions.due_at, positions.chapter, positions.line, positions.ply, positions.fen, positions.expected
    ).offset(offset).limit(2)
    with engine.connect() as db:
        rows = db.execute(query).mappings().all()
    return {"position": dict(rows[0]) if rows else None, "more": len(rows) > 1}

def schedule_review(engine, player, answer):
    columns = opening_positions.c
    key = [columns.player == player, *(columns[name] == answer[name] for name in
            ("chapter", "line", "ply", "fen", "expected", "side"))]
    now = int(time())
    days = case((columns.interval_days == 0, 1), else_=func.min(columns.interval_days * 2, 30))
    interval = days if answer["correct"] else 0
    due = now + (days * 86400 if answer["correct"] else 600)
    with engine.begin() as db:
        # The due time identifies the review that was opened, including after a retry or in two tabs.
        db.execute(update(opening_positions).where(*key, columns.due_at == answer["due_at"], columns.due_at <= now)
                   .values(interval_days=interval, due_at=due))
        stored = db.execute(select(columns.due_at).where(*key)).scalar_one_or_none()
        if stored is None:
            raise GameError("opening_position_missing", 404)
        return {"due_at": stored}
