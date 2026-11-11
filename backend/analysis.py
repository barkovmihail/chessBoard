import asyncio
from contextlib import suppress

import chess
import chess.engine

from .computer import engine_command
from .domain import GameError, start_board


async def evaluate(board, engine_name):
    outcome = board.outcome()
    if outcome:
        return {"outcome": outcome.result(), "line": []}
    transport, engine = await chess.engine.popen_uci(engine_command(engine_name))
    try:
        info = await engine.analyse(board, chess.engine.Limit(time=1))
        score = info["score"].white()
        line = []
        best_uci = info["pv"][0].uci() if info["pv"] else None
        for move in info["pv"][:8]:
            line.append(board.san(move))
            board.push(move)
        return {"cp": score.score(), "mate": score.mate(), "line": line, "best_uci": best_uci}
    finally:
        transport.close()


async def analyse(game, ply, name, request, slots):
    if not game["result"]:
        raise GameError("unfinished_game", 409)
    if ply > len(game["moves"]):
        raise GameError("invalid_ply", 422)
    board = start_board(game.get("chess960"))
    for san in game["moves"][:ply]:
        board.push_san(san)

    async def run():
        async with slots:
            return await evaluate(board, name)

    task = asyncio.create_task(run())
    try:
        async with asyncio.timeout(10):
            while not task.done():
                if await request.is_disconnected():
                    raise GameError("analysis_cancelled", 409)
                await asyncio.wait({task}, timeout=0.1)
            return task.result()
    except (OSError, TimeoutError, chess.engine.EngineError, KeyError) as exc:
        raise GameError("analysis_unavailable", 503) from exc
    finally:
        if not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
