import asyncio
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from backend.analysis import analyse
from backend.domain import GameError


class AnalysisTest(IsolatedAsyncioTestCase):
    async def test_disconnect_stops_search_and_releases_slot(self):
        running = asyncio.Event()
        stopped = asyncio.Event()

        async def evaluate(board, name):
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
