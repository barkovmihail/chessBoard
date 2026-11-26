import chess
from sqlalchemy import func, select, tuple_

from .db import games, moves
from .domain import GameError


def continuations(engine, player, prefix):
    board = chess.Board()
    try:
        for uci in prefix:
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                raise ValueError()
            board.push(move)
    except ValueError as exc:
        raise GameError("invalid_line", 422) from exc

    if not player:
        return []
    archived = select(games.c.id).where(games.c.result.is_not(None), games.c.chess960.is_(None),
        (games.c.owner == player) | (games.c.guest == player))
    if prefix:
        matched = (select(moves.c.game_id).where(moves.c.game_id.in_(archived),
                    tuple_(moves.c.ply, moves.c.uci).in_(list(enumerate(prefix, 1))))
                   .group_by(moves.c.game_id).having(func.count() == len(prefix)))
    else:
        matched = archived
    count = func.count()
    query = (select(moves.c.uci, count).where(moves.c.game_id.in_(matched), moves.c.ply == len(prefix) + 1)
             .group_by(moves.c.uci).order_by(count.desc(), moves.c.uci))
    with engine.connect() as db:
        return [{"san": board.san(chess.Move.from_uci(uci)), "count": n} for uci, n in db.execute(query)]
