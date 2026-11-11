import chess
from sqlalchemy.dialects.sqlite import insert

from .db import opening_positions
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
