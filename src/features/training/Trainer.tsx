import React, { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board, PieceColorType, PieceType, Square } from "../../entities/board";

interface Props {
  fen?: string;
  steps: readonly [string, string][];
  side: "w" | "b";
  puzzle?: boolean;
}

const types = { p: PieceType.Pawn, n: PieceType.Knight, b: PieceType.Bishop,
  r: PieceType.Rook, q: PieceType.Queen, k: PieceType.King };

export function Trainer({ fen, steps, side, puzzle }: Props) {
  const [ply, advance] = useState(0);
  const [selected, select] = useState<Square>();
  const [hint, showHint] = useState(false);
  const [feedback, say] = useState("");
  const [promotion, promote] = useState<Square>();
  const [otherMate, setOtherMate] = useState("");
  const state = useMemo(() => {
    const board = new Chess(fen);
    for (let i = 0; i < ply; i++) board.move(steps[i][0]);
    if (otherMate) board.move(otherMate);
    return board;
  }, [fen, steps, ply, otherMate]);
  const expected = steps[ply];
  const complete = !expected || !!otherMate;
  const automatic = !complete && state.turn() !== side;
  const moves = state.moves({ verbose: true });
  const target = moves.find(move => move.san === expected?.[0] || move.lan === expected?.[0]);
  const history = state.history({ verbose: true });
  const lastMove = history[history.length - 1];

  useEffect(() => {
    if (!automatic) return;
    const timer = setTimeout(() => advance(ply + 1), 650);
    return () => clearTimeout(timer);
  }, [automatic, ply]);

  function attempt(square: Square, choice?: string, from = selected) {
    const candidates = moves.filter(m => m.from === from && m.to === square);
    if (candidates.some(m => m.promotion) && !choice) { select(from); promote(square); return; }
    const move = candidates.find(m => m.promotion === choice);
    promote(undefined);
    select(undefined);
    if (puzzle && move?.san.endsWith("#") && move.lan !== target?.lan) {
      setOtherMate(move.san); say("Мат. Решение верно."); return;
    }
    if (!move || move.lan !== target?.lan) {
      say((move ? "Допустимый ход, но в этой линии нужен другой." : "Так пойти нельзя.") +
        (puzzle ? " Попробуйте ещё раз." : " " + expected[1]));
      return;
    }
    say("Верно, " + move.san + ". " + expected[1]);
    showHint(false);
    advance(ply + 1);
  }
  function click(square: Square) {
    promote(undefined);
    if (state.get(square)?.color === side) { select(selected === square ? undefined : square); return; }
    if (selected) attempt(square);
  }
  return <div className="training-layout">
    <Board position={state.board().flat().flatMap(piece => piece ? [{
      type: types[piece.type], square: piece.square, color: piece.color === "w" ? PieceColorType.White : PieceColorType.Black,
    }] : [])} flipped={side === "b"} lastMove={lastMove} selected={selected}
      targets={hint && target && !complete ? [target.from, target.to] : []}
      movableColor={side === "w" ? "white" : "black"}
      onMove={automatic || complete ? undefined : (from, to) => attempt(to, undefined, from)}
      onSquare={automatic || complete ? undefined : click} />
    <section className="training-notes">
      <h2>{complete ? (puzzle ? "Задача решена" : "Линия пройдена") : automatic ? "Ответ соперника" : "Ваш ход"}</h2>
      <p>{side === "w" ? "Вы играете белыми" : "Вы играете чёрными"}</p>
      <p aria-live="polite">{feedback}</p>
      {!puzzle && lastMove && lastMove.color !== side && <p>Ответ {lastMove.san}. {steps[ply - 1][1]}</p>}
      {!complete && !automatic && <button onClick={() => showHint(true)}>Показать ход</button>}
      {hint && target && !complete && <p>{target.san} · {target.from} → {target.to}. {expected[1]}</p>}
      {promotion && <div>{(["q","r","b","n"] as const).map((p,i) =>
        <button key={p} onClick={() => attempt(promotion, p)}>{["Ферзь","Ладья","Слон","Конь"][i]}</button>)}</div>}
      {history.length > 0 && <p aria-label="Сыгранные ходы">{state.pgn({ newline: " " }).replace(/\[[^\]]*\]/g, "").replace(/\s*\*$/, "").trim()}</p>}
      <button onClick={() => { advance(0); select(undefined); showHint(false); say(""); promote(undefined); setOtherMate(""); }}>Начать заново</button>
    </section>
  </div>;
}
