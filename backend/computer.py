import logging
import os
import shutil
from pathlib import Path
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
LC0_NODES = {"easy": 4, "casual": 12, "normal": 32, "strong": 96, "expert": 256}
STOCKFISH_SKILL = {"easy": 0, "casual": 4, "normal": 8, "strong": 14, "expert": 20}
BUNDLED_ENGINES = Path(__file__).resolve().parent / "bin"


def executable(name):
    if override := os.getenv("CHESS_" + name.upper()):
        return shutil.which(override)
    return shutil.which(str(BUNDLED_ENGINES / name)) or shutil.which(name)


def engine_command(name):
    binary = executable(name)
    args = [binary or name]
    if name == "lc0":
        args.append("--backend=eigen")
        weights = os.getenv("CHESS_LC0_WEIGHTS")
        if not weights and binary == str(BUNDLED_ENGINES / "lc0"):
            weights = str(BUNDLED_ENGINES / "lc0.pb.gz")
        if weights:
            args.append("--weights=" + weights)
    return args


def play_turn(service, game_id, version, name, level):
    with service.engine.connect() as db:
        history = db.scalars(select(moves.c.uci).join(games)
                             .where(games.c.id == game_id, games.c.version == version, games.c.result.is_(None))
                             .order_by(moves.c.ply)).all()
    if len(history) % 2 == 0:
        return False
    board = chess.Board()
    for move in history:
        board.push_uci(move)
    try:
        with chess.engine.SimpleEngine.popen_uci(engine_command(name), timeout=5) as engine:
            if name == "stockfish":
                engine.configure({"Skill Level": STOCKFISH_SKILL[level]})
            limit = chess.engine.Limit(time=0.8, nodes=LC0_NODES[level] if name == "lc0" else None)
            answer = engine.play(board, limit)
        if answer.move is None:
            raise chess.engine.EngineError("No move returned")
    except (OSError, TimeoutError, chess.engine.EngineError) as exc:
        logging.getLogger(__name__).exception("Engine failed for game %s", game_id)
        raise GameError("engine_unavailable", 503) from exc
    try:
        service.apply(game_id, SEATS[name], answer.move.uci(), version, uuid4().hex)
    except GameError as exc:
        if exc.code not in ("stale_version", "game_finished"):
            raise
        return False
    return True


def play_pending(service, stopped: Event):
    ply = select(func.max(moves.c.ply)).where(moves.c.game_id == games.c.id).scalar_subquery()
    with service.engine.connect() as db:
        pending = db.execute(select(games.c.id, games.c.version, games.c.engine_level, games.c.guest)
                             .where(games.c.guest.in_(SEATS.values()), games.c.result.is_(None),
                                    ply % 2 == 1)).all()
    for game_id, version, level, seat in pending:
        if stopped.is_set():
            break
        try:
            if play_turn(service, game_id, version, seat.split(":")[1], level):
                yield game_id
        except GameError:
            continue
