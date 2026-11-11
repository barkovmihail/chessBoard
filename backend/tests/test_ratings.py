from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from sqlalchemy import insert
from backend.db import accounts, open_database
from backend.domain import GameError
from backend.matchmaking import Matchmaking
from backend.service import Games


class RatingsTest(TestCase):
    def test_queue_results_retry_and_flag(self):
        with TemporaryDirectory() as directory:
            engine = open_database(Path(directory) / "games.db")
            now = 1000
            games = Games(engine, lambda: now)
            queue = Matchmaking(games)
            with engine.begin() as db:
                for player in ("a", "b"):
                    db.execute(insert(accounts).values(player=player, name=player, salt=b"x", password_hash=b"x"))
            with self.assertRaises(GameError):
                queue.change("guest", 0, "start", (5, 0), True)
            queue.change("guest", 0, "start", (5, 0))
            self.assertTrue(queue.change("a", 0, "start", (5, 0), True)["waiting"])
            gid = queue.change("b", 0, "start", (5, 0), True)["game_id"]
            for _ in range(2):
                games.apply(gid, "b", "resign", 0, "end")
            self.assertEqual(games.ratings("a"), {"bullet": 1500, "blitz": 1516, "rapid": 1500, "classical": 1500})
            self.assertEqual(games.ratings("b")["blitz"], 1484)
            games.apply(gid, "a", "rematch", 1, "offer-again")
            rematch = games.apply(gid, "b", "rematch", 2, "accept-again")["next_game"]
            now += 300000
            self.assertEqual(games.expire_due(), [rematch])
            self.assertEqual(games.expire_due(), [])
            self.assertEqual(games.ratings("a")["blitz"], 1531)
            engine.dispose()
