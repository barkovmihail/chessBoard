from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from backend.computer import SEATS
from backend.db import open_database
from backend.domain import GameError
from backend.service import Games


class ComputerGameTest(TestCase):
    def test_seats_restart_and_archive(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            db = open_database(path)
            games = Games(db)
            game_id = games.create("human", control=(10, 5), engine_level="normal")["id"]
            games.apply(game_id, "human", "e2e4", 0, uuid4().hex)
            db.dispose()
            db = open_database(path)
            try:
                games = Games(db)
                self.assertEqual(games.get(game_id, "human")["engine_level"], "normal")
                with self.assertRaises(GameError):
                    games.apply(game_id, "human", "e7e5", 1, uuid4().hex)
                games.apply(game_id, SEATS["lc0"], "e7e5", 1, uuid4().hex)
                games.apply(game_id, "human", "resign", 2, uuid4().hex)
                self.assertEqual(games.archive("human", 0, 20)["items"][0]["opponent"], "Leela Chess Zero")
            finally:
                db.dispose()
