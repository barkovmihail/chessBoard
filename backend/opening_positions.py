import chess
from sqlalchemy import select
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
                   positions.expected, study_chapters.c.name.label("chapter_name")).select_from(
        opening_positions.outerjoin(study_chapters, positions.chapter == study_chapters.c.id)
    ).where(positions.player == player).order_by(
        positions.chapter, positions.line, positions.ply, positions.fen, positions.expected
    ).offset(offset).limit(2)
    with engine.connect() as db:
        rows = db.execute(query).mappings().all()
    return {"position": dict(rows[0]) if rows else None, "more": len(rows) > 1}
