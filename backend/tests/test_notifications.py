from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from sqlalchemy import insert
from backend.db import accounts, open_database
from backend.service import Games
from backend.challenges import Challenges
from backend.notifications import Notifications


class NoticeTest(TestCase):
    def test_receipts_preferences_read_scope_and_restart(self):
        with TemporaryDirectory() as root:
            path = Path(root) / "test.db"
            engine = open_database(path)
            with engine.begin() as db:
                for name in ("Alice", "Bob"):
                    db.execute(insert(accounts).values(name=name, player=name, password_hash=b"x", salt=b"x"))
            actions = Challenges(Games(engine))
            notices = Notifications(engine)
            for _ in range(2):
                actions.create("Alice", "Bob", 5, 3, "one")
            feed = notices.feed("Bob")
            self.assertEqual(feed["unread"], 1)
            item, = feed["items"]
            notices.read("Alice", item["id"])
            self.assertEqual(notices.feed("Bob")["unread"], 1)
            notices.read("Bob", item["id"])
            self.assertEqual(len(actions.pending("Bob")), 1)
            for _ in range(2):
                actions.respond("Bob", "one", "decline")
            self.assertEqual(notices.feed("Alice")["unread"], 1)
            notices.preferences("Bob", {"notify_challenge": False})
            actions.create("Alice", "Bob", 1, 0, "two")
            self.assertEqual(len(actions.pending("Bob")), 1)
            self.assertEqual(len(notices.feed("Bob")["items"]), 1)
            notices.read("Alice", None)
            engine.dispose()
            engine = open_database(path)
            self.assertEqual(Notifications(engine).feed("Bob")["unread"], 0)
            self.assertFalse(Notifications(engine).preferences("Bob")["notify_challenge"])
            engine.dispose()
