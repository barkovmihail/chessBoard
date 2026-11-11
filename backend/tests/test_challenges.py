from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from sqlalchemy import func, insert, select
from backend.challenges import Challenges
from backend.db import accounts, games, open_database
from backend.domain import GameError
from backend.service import Games


class ChallengesTest(TestCase):
    def test_permissions_expiry_and_concurrent_decisions(self):
        with TemporaryDirectory() as directory:
            engine = open_database(Path(directory) / "games.db")
            now = 100
            service = Challenges(Games(engine, lambda: now))
            with engine.begin() as db:
                for name in ["Alice", "Bob", "Carol"]:
                    db.execute(insert(accounts).values(player=name, name=name, salt=b"x", password_hash=b"x"))
            def create(key):
                return service.create("Alice", "bOb", 5, 3, key)
            self.assertEqual(create("one"), create("one"))
            self.assertTrue(service.pending("Bob")[0]["incoming"])
            self.assertFalse(service.pending("Alice")[0]["incoming"])
            self.assertEqual(service.pending("Carol"), [])
            for player, action in [("Carol","accept"), ("Alice","accept"), ("Bob","cancel")]:
                with self.assertRaises(GameError):
                    service.respond(player, "one", action)
            self.assertEqual(service.respond("Bob", "one", "decline")["status"], "declined")
            create("two")
            now += 600000
            self.assertEqual(service.pending("Bob"), [])
            self.assertEqual(service.respond("Bob", "two", "accept")["status"], "expired")
            create("three")
            with ThreadPoolExecutor(2) as pool:
                accepted = pool.submit(service.respond, "Bob", "three", "accept")
                cancelled = pool.submit(service.respond, "Alice", "three", "cancel")
                result = accepted.result()
                self.assertEqual(result, cancelled.result())
            self.assertEqual(service.respond("Bob", "three", "accept"), result)
            with engine.connect() as db:
                self.assertEqual(db.scalar(select(func.count()).select_from(games)), int(result["status"] == "accepted"))
            engine.dispose()
