import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from fastapi import HTTPException
import zstandard

from backend.import_puzzles import FIELDS
from backend.pack_puzzles import pack
from backend.puzzles import puzzle_by_id, random_puzzle, themes_for_ids


class PuzzleFilterTest(TestCase):
    def test_packed_catalogue_ranks_lookup_and_profile(self):
        with TemporaryDirectory() as directory:
            archive = Path(directory) / "puzzles.zst"
            target = Path(directory) / "puzzles.pack"
            entries = [("00a", "fork pin"), ("00b", "forkish"), ("AAa", "pin"), ("AAz", "fork")]
            csv = ",".join(FIELDS) + "\n" + "".join(
                f"{key},fen,e2e4 e7e5,1500,90,98,1,{themes},url,\n" for key, themes in entries)
            archive.write_bytes(zstandard.ZstdCompressor().compress(csv.encode()))
            self.assertEqual(pack(archive, target), {"": 4, "fork": 2, "pin": 2})
            for rank, expected in enumerate(("00a", "AAz")):
                with patch("backend.packed_puzzles.secrets.randbelow", return_value=rank):
                    row = random_puzzle(target, "fork")
                self.assertEqual(row["puzzle_id"], expected)
                self.assertEqual(puzzle_by_id(target, expected), row)
            self.assertEqual(dict(themes_for_ids(target, ["AAz", "00b", "unknown"])),
                             {"00b": "forkish", "AAz": "fork"})
            with self.assertRaises(HTTPException) as missing:
                puzzle_by_id(target, "00x")
            self.assertEqual(missing.exception.status_code, 404)
            with self.assertRaises(HTTPException) as empty:
                random_puzzle(target, "endgame")
            self.assertEqual(empty.exception.status_code, 404)

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
