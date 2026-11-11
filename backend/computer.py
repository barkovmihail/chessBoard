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
SEATS = {"lc0": "computer:lc0", "stockfish": "computer:stockfish"}
NAMES = {"lc0": "Leela Chess Zero", "stockfish": "Stockfish"}
LEVELS = {"easy": 4, "normal": 32}


def executable(name):
    return shutil.which(os.getenv("CHESS_" + name.upper(), name))


def engine_command(name):
    args = [executable(name) or name]
    if name == "lc0":
        args.append("--backend=eigen")
        if weights := os.getenv("CHESS_LC0_WEIGHTS"):
            args.append("--weights=" + weights)
    return args


def play_pending(service, stopped: Event):
    ply = select(func.max(moves.c.ply)).where(moves.c.game_id == games.c.id).scalar_subquery()
    with service.engine.connect() as db:
        pending = db.execute(select(games.c.id, games.c.version, games.c.engine_level, games.c.guest)
                             .where(games.c.guest.in_(SEATS.values()), games.c.result.is_(None),
                                    ply % 2 == 1)).all()
    for game_id, version, level, seat in pending:
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
            name = seat.split(":")[1]
            with chess.engine.SimpleEngine.popen_uci(engine_command(name), timeout=5) as engine:
                if name == "stockfish":
                    engine.configure({"Skill Level": 0 if level == "easy" else 8})
                limit = chess.engine.Limit(time=0.8, nodes=LEVELS[level] if name == "lc0" else None)
                answer = engine.play(board, limit)
            service.apply(game_id, seat, answer.move.uci(), version, uuid4().hex)
            yield game_id
        except GameError:
            continue  # The clock or another command changed this position.
        except (OSError, TimeoutError, chess.engine.EngineError, AttributeError):
            logging.getLogger(__name__).exception("Engine failed for game %s", game_id)
