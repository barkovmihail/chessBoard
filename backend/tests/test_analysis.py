import asyncio
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from backend.analysis import analyse, practice_position
from backend.domain import GameError


class AnalysisTest(IsolatedAsyncioTestCase):
    async def test_disconnect_stops_search_and_releases_slot(self):
        running = asyncio.Event()
        stopped = asyncio.Event()

        async def evaluate(board, name, compare):
            running.set()
            try:
                await asyncio.Future()
            finally:
                stopped.set()

        request = AsyncMock()
        request.is_disconnected.side_effect = lambda: running.is_set()
        slots = asyncio.Semaphore(1)
        with patch("backend.analysis.evaluate", evaluate), self.assertRaises(GameError) as ctx:
            await analyse({"moves": ["e4"], "result": "1-0"}, 1, "lc0", request, slots)
        self.assertEqual(ctx.exception.code, "analysis_cancelled")
        self.assertTrue(stopped.is_set())
        self.assertFalse(slots.locked())

    async def test_only_finished_games_and_recorded_positions(self):
        for result, ply, code in [(None, 0, "unfinished_game"), ("1-0", 2, "invalid_ply")]:
            with self.assertRaises(GameError) as ctx:
                await analyse({"moves": ["e4"], "result": result}, ply, "stockfish", AsyncMock(), asyncio.Semaphore(1))
            self.assertEqual(ctx.exception.code, code)

    def test_practice_variation_isolated_from_game(self):
        game = {"moves": ["e4", "e5"], "result": "1/2-1/2", "chess960": 518}
        view = practice_position(game, 2, ["c7c5", "g1f3"])
        self.assertEqual(view["moves"], ["c5", "Nf3"])
        self.assertIn("b8c6", view["legal"])
        self.assertEqual(game["moves"], ["e4", "e5"])
        for changed, ply, line, code in [
            ({**game, "result": None}, 1, [], "unfinished_game"),
            (game, 3, [], "invalid_ply"),
            (game, 2, ["a1a8"], "illegal_move"),
        ]:
            with self.assertRaises(GameError) as invalid:
                practice_position(changed, ply, line)
            self.assertEqual(invalid.exception.code, code)
