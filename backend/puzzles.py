"""Read-only Lichess catalogue, shared independently of private game databases."""
import secrets
import sqlite3
from contextlib import closing
from pathlib import Path

from fastapi import HTTPException


def random_puzzle(path: Path, theme: str | None = None):
    if not path.is_file():
        raise HTTPException(503, "puzzles_unavailable")
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        count = db.execute("SELECT max(rowid) FROM puzzles").fetchone()[0]
        if not count:
            raise HTTPException(404, "no_matching_puzzles")
        start = secrets.randbelow(count) + 1
        # Start near a random row and wrap once. Common themes need only a short indexed range.
        query = "SELECT puzzle_id, fen, moves, rating, themes FROM puzzles WHERE "
        match = " AND instr(' ' || themes || ' ', ?) > 0" if theme else ""
        params = (" " + theme + " ",) if theme else ()
        row = db.execute(query + "rowid >= ?" + match + " ORDER BY rowid LIMIT 1",
                         (start, *params)).fetchone()
        if row is None:
            row = db.execute(query + "rowid < ?" + match + " ORDER BY rowid LIMIT 1",
                             (start, *params)).fetchone()
        if row is None:
            raise HTTPException(404, "no_matching_puzzles")
        return {**dict(row), "moves": row["moves"].split(), "themes": row["themes"].split()}
