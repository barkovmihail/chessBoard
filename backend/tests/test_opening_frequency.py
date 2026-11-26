from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from backend.db import open_database
from backend.opening_frequency import continuations
from backend.service import Games


class FrequencyTest(TestCase):
    def test_only_matching_lines_in_own_finished_games(self):
        with TemporaryDirectory() as directory:
            db = open_database(Path(directory) / "games.db")
            try:
                games = Games(db)
                for white, black, first, finished in [
                    ("me", "a", "e2e4", True), ("b", "me", "d2d4", True),
                    ("other", "a", "e2e4", True), ("me", "b", "e2e4", False),
                ]:
                    game = games.create(white, True)["id"]
                    games.join(game, black)
                    games.apply(game, white, first, 0, "first")
                    games.apply(game, black, "g8f6", 1, "second")
                    if finished:
                        games.apply(game, white, "resign", 2, "finish")
                self.assertEqual(continuations(db, "me", []), [{"san": "d4", "count": 1}, {"san": "e4", "count": 1}])
                self.assertEqual(continuations(db, "me", ["e2e4"]), [{"san": "Nf6", "count": 1}])
                self.assertEqual(continuations(db, None, []), [])
            finally:
                db.dispose()
