from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from sqlalchemy import func, select

from backend.db import games, open_database
from backend.matchmaking import Matchmaking
from backend.service import Games


class MatchmakingTest(TestCase):
    def test_cancel_retry_expiry_and_concurrent_pair(self):
        with TemporaryDirectory() as directory:
            engine = open_database(Path(directory) / "test.db")
            now = 5000
            queue = Matchmaking(Games(engine, lambda: now))
            def start(player, version=0, control=(5, 0)):
                return queue.change(player, version, "start", control)
            start("a")
            queue.change("a", 1, "cancel")
            self.assertFalse(start("a")["waiting"])
            start("b")
            now += 90001
            self.assertFalse(queue.status("b")["waiting"])
            self.assertTrue(start("a", 2)["waiting"])
            self.assertTrue(start("c", control=(5, 3))["waiting"])
            with ThreadPoolExecutor(2) as pool:
                tickets = list(pool.map(start, ["d", "d"]))
            self.assertEqual(tickets[0], tickets[1])
            self.assertEqual(queue.status("a")["game_id"], tickets[0]["game_id"])
            self.assertIsNotNone(tickets[0]["game_id"])
            self.assertEqual(queue.change("a", 3, "cancel")["game_id"], tickets[0]["game_id"])
            with engine.connect() as db:
                self.assertEqual(db.scalar(select(func.count()).select_from(games)), 1)
            engine.dispose()
