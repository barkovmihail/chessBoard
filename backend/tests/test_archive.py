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

    def test_colour_filter_precedes_pagination_and_preserves_private_and_local_games(self):
        with TemporaryDirectory() as directory:
            engine = open_database(Path(directory) / "games.db")
            now = 1000
            service = Games(engine, lambda: now)
            ids = {"white": [], "black": []}
            for side in ("white", "black", "white", "black", "black", "white"):
                white, black = ("player", "friend") if side == "white" else ("friend", "player")
                game = service.create(white, True)["id"]
                service.join(game, black)
                now += 1000
                service.apply(game, black, "resign", 0, "end")
                ids[side].insert(0, game)
            local = service.create("player")["id"]
            for ply, move in enumerate(("f2f3", "e7e5", "g2g4", "d8h4")):
                now += 1000
                service.apply(local, "player", move, ply, move)
            self.assertEqual(service.archive("player", 0, 1)["items"][0]["side"], "both")
            self.assertEqual(service.archive("player", 0, 20, "all"), service.archive("player", 0, 20))
            self.assertEqual(len(service.archive("friend", 0, 20)["items"]), 6)
            for side, ordered in ids.items():
                first = service.archive("player", 0, 2, side)
                self.assertEqual([(g["id"], g["side"]) for g in first["items"]], [(key, side) for key in ordered[:2]])
                self.assertEqual(first["next_offset"], 2)
                last = service.archive("player", first["next_offset"], 2, side)
                self.assertEqual([g["id"] for g in last["items"]], ordered[2:])
                self.assertIsNone(last["next_offset"])
                self.assertEqual(service.archive("stranger", 0, 2, side)["items"], [])
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
