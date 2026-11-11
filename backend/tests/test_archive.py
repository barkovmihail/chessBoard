from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from backend.db import open_database
from backend.service import Games


class ArchiveTest(TestCase):
    def test_owner_filter_dates_and_pages(self):
        with TemporaryDirectory() as directory:
            engine = open_database(Path(directory) / "games.db")
            now = 1000
            service = Games(engine, lambda: now)
            ids = []
            for _ in range(3):
                gid = service.create("player", True)["id"]
                service.join(gid, "friend")
                now += 1000
                service.apply(gid, "friend", "resign", 0, "end")
                ids.insert(0, gid)
            service.create("player")
            page = service.archive("friend", 0, 2)
            self.assertEqual([row["id"] for row in page["items"]], ids[:2])
            self.assertEqual(page["items"][0]["finished_ms"], now)
            self.assertEqual(page["items"][0]["side"], "black")
            self.assertEqual(page["next_offset"], 2)
            last = service.archive("player", 2, 2)
            self.assertEqual(last["items"][0]["id"], ids[-1])
            self.assertIsNone(last["next_offset"])
            self.assertEqual(service.archive("other", 0, 2)["items"], [])
            engine.dispose()


    def test_active_games_follow_moves_and_archive_transition(self):
        with TemporaryDirectory() as directory:
            engine = open_database(Path(directory) / "games.db")
            service = Games(engine)
            game = service.create("white", True, (5, 3))["id"]
            local = service.create("white")["id"]
            self.assertEqual(service.active_games("white", 0, 1)["next_offset"], 1)
            first = {entry["id"]: entry for entry in service.active_games("white", 0, 20)["items"]}
            self.assertTrue(first[game]["waiting"])
            self.assertFalse(first[local]["waiting"])
            self.assertEqual(service.active_games("other", 0, 20)["items"], [])
            service.join(game, "black")
            service.apply(game, "white", "offer", 0, "draw")
            service.apply(game, "white", "e2e4", 1, "move")
            entry, = service.active_games("black", 0, 20)["items"]
            self.assertEqual((entry["side"], entry["turn"], entry["base_minutes"]), ("black", "black", 5))
            service.apply(game, "black", "resign", 2, "end")
            self.assertEqual(service.active_games("black", 0, 20)["items"], [])
            self.assertEqual(service.archive("black", 0, 20)["items"][0]["id"], game)
            engine.dispose()
