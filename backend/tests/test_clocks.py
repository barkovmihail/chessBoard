from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from sqlalchemy import select

from backend.db import moves, open_database
from backend.domain import GameError
from backend.service import Games


class ClockTest(TestCase):
    def test_increment_retry_restart_and_flag_without_clients(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "clocks.db"
            now = 10000
            engine = open_database(path)
            games = Games(engine, lambda: now)
            game_id = games.create("white", True, (5, 3))["id"]
            now += 600000
            self.assertIsNone(games.get(game_id, "white")["clock"]["deadline_ms"])
            games.join(game_id, "black")
            now += 2000
            moved = games.apply(game_id, "white", "e2e4", 0, "first")
            self.assertEqual(moved["clock"]["white_ms"], 301000)
            now += 500
            self.assertEqual(games.apply(game_id, "white", "e2e4", 0, "first")["clock"]["white_ms"], 301000)
            engine.dispose()
            engine = open_database(path)
            games = Games(engine, lambda: now)
            restored = games.get(game_id, "white")
            self.assertEqual(restored["clock"]["deadline_ms"] - now, 299500)
            now += 299500
            def late_move():
                try:
                    games.apply(game_id, "black", "c7c5", 1, "late")
                except GameError as exc:
                    self.assertEqual(exc.status, 409)
            with ThreadPoolExecutor(2) as pool:
                move = pool.submit(late_move)
                sweep = pool.submit(games.expire_due)
                move.result()
                sweep.result()
            result = games.get(game_id, "black")
            self.assertEqual((result["result"], result["reason"], result["version"]), ("1-0", "timeout", 2))
            self.assertEqual(result["moves"], ["e4"])
            self.assertEqual(result["clock"]["black_ms"], 0)
            second = games.create("owner", False, (7, 0))
            now += 1000
            reply = games.apply(second["id"], "owner", "d2d4", 0, "move")
            self.assertEqual(reply["clock"]["white_ms"], 419000)
            now += 420000
            self.assertEqual(games.expire_due(), [second["id"]])
            self.assertIsNone(games.get(second["id"], "owner")["clock"]["deadline_ms"])
            self.assertNotIn("clock", games.create("untimed"))
            engine.dispose()

    def test_move_times_survive_retries_and_include_final_move(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "times.db"
            now = 1000
            engine = open_database(path)
            games = Games(engine, lambda: now)
            game_id = games.create("white", True, (5, 3))["id"]
            now += 100000
            games.join(game_id, "black")
            durations = [7000, 2300, 4100, 500]
            for ply, (move, duration) in enumerate(zip(("f2f3", "e7e5", "g2g4", "d8h4"), durations)):
                player = ("white", "black")[ply % 2]
                now += duration
                result = games.apply(game_id, player, move, ply, str(ply))
                games.apply(game_id, player, move, ply, str(ply))
            self.assertEqual(result["reason"], "checkmate")
            untimed = games.create("solo")["id"]
            games.apply(untimed, "solo", "e2e4", 0, "first")
            engine.dispose()
            engine = open_database(path)
            with engine.connect() as db:
                read = select(moves.c.elapsed_ms).order_by(moves.c.ply)
                self.assertEqual(db.scalars(read.where(moves.c.game_id == game_id)).all(), durations)
                self.assertEqual(db.scalars(read.where(moves.c.game_id == untimed)).all(), [None])
            engine.dispose()
