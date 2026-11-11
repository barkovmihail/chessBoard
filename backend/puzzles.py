"""Read-only Lichess catalogue, shared independently of private game databases."""
import secrets
import sqlite3
from contextlib import closing
from pathlib import Path

from fastapi import HTTPException


def random_puzzle(path: Path):
    if not path.is_file():
        raise HTTPException(503, "puzzles_unavailable")
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        count = db.execute("SELECT max(rowid) FROM puzzles").fetchone()[0]
        row = db.execute("SELECT puzzle_id, fen, moves, rating, themes FROM puzzles WHERE rowid=?",
                         (secrets.randbelow(count) + 1,)).fetchone()
        return {**dict(row), "moves": row["moves"].split(), "themes": row["themes"].split()}
