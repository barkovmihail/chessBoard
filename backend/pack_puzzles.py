"""Pack the sorted, newline-delimited Lichess puzzle CSV for the Vercel function."""
import argparse
import csv
import hashlib
import io
import sqlite3
from collections import Counter
from contextlib import closing
from itertools import groupby
from pathlib import Path
from tempfile import NamedTemporaryFile

import zstandard

from .import_puzzles import FIELDS
from .packed_puzzles import THEMES


def pack(archive, target, assets=None):
    compressor = zstandard.ZstdCompressor(level=12)
    totals = Counter()
    if assets is not None:
        assets.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=target.parent, delete=False) as temp:
        staged = Path(temp.name)
    try:
        with closing(sqlite3.connect(staged)) as db, zstandard.open(archive, "rb") as source:
            lines = io.BufferedReader(source)
            header = next(lines).decode().strip().split(",")
            if header[:len(FIELDS)] != FIELDS:
                raise ValueError("Unexpected Lichess puzzle CSV header")
            db.executescript("""
                CREATE TABLE blocks(prefix TEXT PRIMARY KEY, data BLOB, asset TEXT);
                CREATE TABLE ranges(theme TEXT, stop INTEGER, start INTEGER, prefix TEXT,
                                    PRIMARY KEY(theme, stop)) WITHOUT ROWID;
            """)
            previous = ""
            for prefix, group in groupby(lines, key=lambda line: line[:2].decode("ascii")):
                data = b"".join(group)
                counts = Counter()
                for row in csv.reader(io.StringIO(data.decode("utf-8"))):
                    if row[0] <= previous or len(row) != len(header):
                        raise ValueError(f"Invalid or unordered puzzle: {row[0]}")
                    previous = row[0]
                    counts[""] += 1
                    counts.update(THEMES.intersection(row[7].split()))
                compressed = compressor.compress(data)
                asset = None
                if assets is not None:
                    asset = hashlib.sha256(compressed).hexdigest()
                    (assets / (asset + ".zst")).write_bytes(compressed)
                    compressed = None
                db.execute("INSERT INTO blocks VALUES (?, ?, ?)", (prefix, compressed, asset))
                for theme, count in counts.items():
                    start = totals[theme]
                    totals[theme] += count
                    db.execute("INSERT INTO ranges VALUES (?, ?, ?, ?)", (theme, totals[theme], start, prefix))
            if not totals[""] or db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise ValueError("Invalid puzzle catalogue")
            db.commit()
        staged.replace(target)
        return totals
    finally:
        staged.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--assets", type=Path, help="Write compressed blocks as separate static assets")
    args = parser.parse_args()
    print("Puzzle counts (empty key = all):", dict(pack(args.archive, args.target, args.assets)))
