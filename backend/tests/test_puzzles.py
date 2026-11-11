import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from fastapi import HTTPException

from backend.puzzles import puzzle_by_id, random_puzzle


class PuzzleFilterTest(TestCase):
    def test_wrap_and_exact_theme(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "catalogue.db"
            db = sqlite3.connect(path)
            db.execute("CREATE TABLE puzzles(puzzle_id, fen, moves, rating, themes)")
            db.executemany("INSERT INTO puzzles VALUES (?, '', 'e2e4', 1000, ?)",
                           [("first", "fork pin"), ("last", "forkish")])
            db.commit()
            db.close()
            with patch("backend.puzzles.secrets.randbelow", return_value=1):
                self.assertEqual(random_puzzle(path, "fork")["puzzle_id"], "first")
                self.assertEqual(random_puzzle(path)["puzzle_id"], "last")
            self.assertEqual(puzzle_by_id(path, "first"), {
                "puzzle_id": "first", "fen": "", "moves": ["e2e4"], "rating": 1000, "themes": ["fork", "pin"],
            })
            with self.assertRaises(HTTPException) as missing:
                puzzle_by_id(path, "removed")
            self.assertEqual((missing.exception.status_code, missing.exception.detail), (404, "puzzle_missing"))
            with self.assertRaises(HTTPException) as ctx:
                random_puzzle(path, "endgame")
            self.assertEqual(ctx.exception.status_code, 404)
