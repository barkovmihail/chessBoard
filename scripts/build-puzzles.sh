#!/usr/bin/env bash
set -euo pipefail

snapshot=$(python -c 'from backend.packed_puzzles import SNAPSHOT_URL; print(SNAPSHOT_URL)')
curl --fail --location --silent --show-error --retry 3 \
    "$snapshot/index.pack" --output backend/puzzles.pack
python - <<'PY'
from pathlib import Path
from backend.puzzles import puzzle_by_id

if puzzle_by_id(Path("backend/puzzles.pack"), "00008")["puzzle_id"] != "00008":
    raise RuntimeError("Puzzle snapshot failed its lookup check")
PY
