from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, insert, text
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

    def test_turn_preferences_result_retries_and_flag(self):
        with TemporaryDirectory() as root:
            engine = open_database(Path(root) / "test.db")
            with engine.begin() as db:
                for name in ("Alice", "Bob"):
                    db.execute(insert(accounts).values(name=name, player=name, password_hash=b"x", salt=b"x"))
            now = 1000
            games = Games(engine, lambda: now)
            notices = Notifications(engine)
            game_id = games.create("Alice", True, (1, 0))["id"]
            notices.preferences("Alice", {"notify_turn": False})
            games.join(game_id, "Bob")
            for _ in range(2):
                games.apply(game_id, "Alice", "e2e4", 0, "first")
            entry, = notices.feed("Bob")["items"]
            self.assertEqual((entry["kind"], entry["opponent"], entry["game_id"]), ("turn", "Alice", game_id))
            games.apply(game_id, "Bob", "e7e5", 1, "reply")
            self.assertEqual(notices.feed("Alice")["items"], [])
            self.assertEqual(games.active_games("Alice", 0, 20)["items"][0]["turn"], "white")
            now += 60000
            for _ in range(2):
                games.expire_due()
            for name in ("Alice", "Bob"):
                end, = [n for n in notices.feed(name)["items"] if n["kind"] == "finish"]
                self.assertEqual((end["result"], end["game_id"]), ("0-1", game_id))
            engine.dispose()

    def test_migration_preserves_read_challenge(self):
        with TemporaryDirectory() as root:
            path = Path(root) / "legacy.db"
            old = create_engine("sqlite:///" + str(path))
            config = Config()
            config.set_main_option("script_location", "backend/migrations")
            with old.begin() as db:
                config.attributes["connection"] = db
                command.upgrade(config, "011_notifications")
                for name in ("Alice", "Bob"):
                    db.execute(text("INSERT INTO accounts(player,name,password_hash,salt) VALUES (:n,:n,x'00',x'00')"), {"n": name})
                db.execute(text("INSERT INTO challenges(id,sender,recipient,minutes,increment,expires,status) "
                                "VALUES ('old','Alice','Bob',5,3,1000,'pending')"))
                db.execute(text("INSERT INTO notifications(id,player,challenge_id,kind,created,seen) "
                                "VALUES (7,'Bob','old','challenge',1,1)"))
            old.dispose()
            engine = open_database(path)
            feed = Notifications(engine).feed("Bob")
            self.assertEqual(feed["unread"], 0)
            item, = feed["items"]
            self.assertEqual((item["id"], item["opponent"], item["kind"]), (7, "Alice", "challenge"))
            engine.dispose()
