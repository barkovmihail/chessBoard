"""Random access to a full Lichess CSV stored as independently compressed ID prefixes."""
import csv
import hashlib
import io
import os
import secrets
from collections import defaultdict
from functools import lru_cache
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import HTTPException

THEMES = {"fork", "pin", "endgame", "mateIn1", "mateIn2"}


@lru_cache(maxsize=32)
def load_asset(digest):
    domain = (os.getenv("VERCEL_PROJECT_PRODUCTION_URL") if os.getenv("VERCEL_ENV") == "production"
              else os.getenv("VERCEL_URL"))
    if not domain:
        raise HTTPException(503, "puzzles_unavailable")
    try:
        with urlopen(f"https://{domain}/puzzle-data/{digest}.zst", timeout=10) as response:
            data = response.read()
    except (OSError, URLError) as error:
        raise HTTPException(503, "puzzles_unavailable") from error
    if hashlib.sha256(data).hexdigest() != digest:
        raise HTTPException(503, "puzzles_unavailable")
    return data


def block_rows(db, prefix):
    import zstandard

    block = db.execute("SELECT data, asset FROM blocks WHERE prefix = ?", (prefix,)).fetchone()
    if block is None:
        return
    compressed = block[0] if block[0] is not None else load_asset(block[1])
    data = zstandard.ZstdDecompressor().decompress(compressed)
    for row in csv.reader(io.StringIO(data.decode("utf-8"))):
        yield row


def puzzle(row):
    return {"puzzle_id": row[0], "fen": row[1], "moves": row[2].split(),
            "rating": int(row[3]), "themes": row[7].split()}


def by_id(db, puzzle_id):
    for row in block_rows(db, puzzle_id[:2]):
        if row[0] == puzzle_id:
            return puzzle(row)
    raise HTTPException(404, "puzzle_missing")


def random_from(db, theme):
    key = theme or ""
    total = db.execute("SELECT max(stop) FROM ranges WHERE theme = ?", (key,)).fetchone()[0]
    if not total:
        raise HTTPException(404, "no_matching_puzzles")
    rank = secrets.randbelow(total)
    prefix, start = db.execute("SELECT prefix, start FROM ranges WHERE theme = ? AND stop > ? "
                               "ORDER BY stop LIMIT 1", (key, rank)).fetchone()
    for row in block_rows(db, prefix):
        if theme and theme not in row[7].split():
            continue
        if rank == start:
            return puzzle(row)
        start += 1
    raise ValueError("Puzzle catalogue range exceeds block size")


def themes_for_ids(db, ids):
    groups = defaultdict(set)
    for puzzle_id in ids:
        groups[puzzle_id[:2]].add(puzzle_id)
    for prefix, wanted in groups.items():
        for row in block_rows(db, prefix):
            if row[0] in wanted:
                yield row[0], row[7]
