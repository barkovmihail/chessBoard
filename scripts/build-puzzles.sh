#!/usr/bin/env bash
set -euo pipefail

archive=$(mktemp)
trap 'rm -f "$archive"' EXIT
curl --fail --location --silent --show-error --retry 3 \
    https://database.lichess.org/lichess_db_puzzle.csv.zst --output "$archive"
python -m backend.pack_puzzles "$archive" backend/puzzles.pack
