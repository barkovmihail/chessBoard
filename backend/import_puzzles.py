"""Import a complete Lichess .csv.zst archive into an atomically replaced catalogue."""
import argparse
import csv
import io
import sqlite3
from contextlib import closing
from itertools import batched
from pathlib import Path
from tempfile import NamedTemporaryFile

import zstandard

FIELDS = "PuzzleId FEN Moves Rating RatingDeviation Popularity NbPlays Themes GameUrl OpeningTags".split()


def import_archive(archive: Path, target: Path):
    with NamedTemporaryFile(dir=target.parent, delete=False) as temp:
        staged = Path(temp.name)
    try:
        with closing(sqlite3.connect(staged)) as db, archive.open("rb") as compressed:
            db.execute("""CREATE TABLE puzzles (
                puzzle_id TEXT NOT NULL, fen TEXT NOT NULL, moves TEXT NOT NULL, rating INTEGER NOT NULL,
                rating_deviation INTEGER, popularity INTEGER, plays INTEGER, themes TEXT,
                game_url TEXT, opening_tags TEXT, daily_date INTEGER)""")
            with zstandard.ZstdDecompressor().stream_reader(compressed) as stream:
                rows = csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8", newline=""))
                if not set(FIELDS).issubset(rows.fieldnames or ()):
                    raise ValueError("Unexpected puzzle CSV header")
                for batch in batched(rows, 8192):
                    db.executemany("INSERT INTO puzzles VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                                   [tuple(row[key] for key in FIELDS) + (row.get("DailyDate") or None,)
                                    for row in batch])
            db.execute("CREATE UNIQUE INDEX puzzles_id ON puzzles(puzzle_id)")
            count = db.execute("SELECT count(*) FROM puzzles").fetchone()[0]
            if not count or db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise ValueError("Invalid puzzle catalogue")
            db.commit()
        staged.replace(target)
        return count
    finally:
        staged.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--database", type=Path, default=Path("puzzles.sqlite3"))
    args = parser.parse_args()
    print(f"Imported {import_archive(args.archive, args.database):,} puzzles into {args.database}")
