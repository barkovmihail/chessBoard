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

    def test_separate_chess960_queue_assigns_one_position(self):
        with TemporaryDirectory() as directory:
            engine = open_database(Path(directory) / "games.db")
            service = Games(engine)
            queue = Matchmaking(service)
            try:
                self.assertTrue(queue.change("white", 0, "start", (5, 3), chess960=True)["waiting"])
                self.assertTrue(queue.change("standard", 0, "start", (5, 3))["waiting"])
                with ThreadPoolExecutor(2) as pool:
                    tickets = list(pool.map(lambda _: queue.change("black", 0, "start", (5, 3), chess960=True), range(2)))
                self.assertEqual(tickets[0], tickets[1])
                game = tickets[0]["game_id"]
                self.assertEqual(game, queue.status("white")["game_id"])
                self.assertTrue(queue.status("standard")["waiting"])
                index = service.get(game, "white")["chess960"]
                self.assertIn(index, range(960))
                self.assertEqual(service.get(game, "black")["chess960"], index)
            finally:
                engine.dispose()

    def test_existing_ticket_is_in_standard_queue_after_upgrade(self):
        from alembic import command
        from alembic.config import Config
        from sqlalchemy import create_engine, text
        from backend.domain import GameError

        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            old = create_engine("sqlite:///" + str(path))
            config = Config()
            config.set_main_option("script_location", "backend/migrations")
            with old.begin() as db:
                config.attributes["connection"] = db
                command.upgrade(config, "023_chess960")
                db.execute(text("INSERT INTO match_queue(player, version, minutes, increment, started, expires) "
                                "VALUES ('legacy', 1, 5, 3, 1, 90001)"))
            old.dispose()
            engine = open_database(path)
            try:
                service = Games(engine, lambda: 100)
                queue = Matchmaking(service)
                self.assertFalse(queue.status("legacy")["chess960"])
                with self.assertRaises(GameError):
                    queue.change("x", 0, "start", (5, 3), rated=True, chess960=True)
                self.assertTrue(queue.change("x", 0, "start", (5, 3), chess960=True)["waiting"])
                matched = queue.change("standard", 0, "start", (5, 3))
                self.assertIsNone(service.get(matched["game_id"], "legacy")["chess960"])
            finally:
                engine.dispose()
