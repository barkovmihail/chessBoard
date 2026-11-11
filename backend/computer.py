import logging
import os
import shutil
from threading import Event
from uuid import uuid4

import chess
import chess.engine
from sqlalchemy import func, select

from .db import games, moves
from .domain import GameError

# Session identities are generated as hex strings, so this seat cannot be claimed.
COMPUTER = "computer:lc0"
LEVELS = {"easy": 4, "normal": 32}


def executable():
    return shutil.which(os.getenv("CHESS_LC0", "lc0"))


def play_pending(service, stopped: Event):
    ply = select(func.max(moves.c.ply)).where(moves.c.game_id == games.c.id).scalar_subquery()
    with service.engine.connect() as db:
        pending = db.execute(select(games.c.id, games.c.version, games.c.engine_level)
                             .where(games.c.guest == COMPUTER, games.c.result.is_(None),
                                    ply % 2 == 1)).all()
    for game_id, version, level in pending:
        if stopped.is_set():
            break
        with service.engine.connect() as db:
            history = db.scalars(select(moves.c.uci).where(moves.c.game_id == game_id)
                                 .order_by(moves.c.ply)).all()
        board = chess.Board()
        for move in history:
            board.push_uci(move)
        if board.turn != chess.BLACK:
            continue
        try:
            args = [executable() or "lc0", "--backend=eigen"]
            if weights := os.getenv("CHESS_LC0_WEIGHTS"):
                args.append("--weights=" + weights)
            with chess.engine.SimpleEngine.popen_uci(args, timeout=5) as engine:
                answer = engine.play(board, chess.engine.Limit(nodes=LEVELS[level], time=0.8))
            service.apply(game_id, COMPUTER, answer.move.uci(), version, uuid4().hex)
            yield game_id
        except GameError:
            continue  # The clock or another command changed this position.
        except (OSError, TimeoutError, chess.engine.EngineError, AttributeError):
            logging.getLogger(__name__).exception("Engine failed for game %s", game_id)
