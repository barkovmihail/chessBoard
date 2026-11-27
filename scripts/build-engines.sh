#!/usr/bin/env bash
set -euo pipefail

# Compile for the runtime CPU family, without build-machine-specific instructions.
case "$(uname -m)" in
    x86_64) stockfish_arch=x86-64 ;;
    aarch64) stockfish_arch=armv8 ;;
    *) echo "Unsupported engine architecture: $(uname -m)" >&2; exit 1 ;;
esac

bin="$PWD/backend/bin"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$bin"

git clone --quiet --depth 1 --branch sf_15.1 https://github.com/official-stockfish/Stockfish.git "$work/stockfish"
test "$(git -C "$work/stockfish" rev-parse HEAD)" = 758f9c9350abee36a5865ec701560db8ea62004d
make -C "$work/stockfish/src" -j2 build ARCH="$stockfish_arch"
install -m 755 "$work/stockfish/src/stockfish" "$bin/stockfish"

git clone --quiet --depth 1 --branch v0.29.0 --recurse-submodules https://github.com/LeelaChessZero/lc0.git "$work/lc0"
test "$(git -C "$work/lc0" rev-parse HEAD)" = afdd67c2186f1f29893d495750661a871f7aa9ac
uv venv "$work/tools"
uv pip install --python "$work/tools/bin/python" meson==1.7.2 ninja==1.11.1.4
(
    export PATH="$work/tools/bin:$PATH"
    meson setup "$work/build" "$work/lc0" --buildtype=plain -Dcpp_args=-O2 \
        -Db_lto=false -Dgtest=false -Dopenblas=false -Dplain_cuda=false -Dispc=false
    meson compile -C "$work/build" -j2 lc0
)
install -m 755 "$work/build/lc0" "$bin/lc0"
curl -fsSL --retry 3 https://storage.lczero.org/files/networks/3e3444370b9fe413244fdc79671a490e19b93d3cca1669710ffeac890493d198 \
    -o "$bin/lc0.pb.gz"
echo "ca9a751e614cc753cb38aee247972558cf4dc9d82c5d9e13f2f1f464e350ec23  $bin/lc0.pb.gz" | sha256sum --check

# Exercise the same UCI commands as a game, including loading the neural networks.
python - <<'PY'
import chess
import chess.engine
from backend.computer import engine_command

board = chess.Board()
board.push_uci("e2e4")
for name in ("lc0", "stockfish"):
    with chess.engine.SimpleEngine.popen_uci(engine_command(name)) as engine:
        reply = engine.play(board, chess.engine.Limit(nodes=8)).move
        if reply not in board.legal_moves:
            raise RuntimeError(f"{name} returned an invalid reply: {reply}")
        print(f"{name}: e2e4 {reply}")
PY
