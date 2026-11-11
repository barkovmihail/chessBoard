import { useLanguage } from "../../shared/language";
import React, { useEffect, useMemo, useState } from "react";
import { ArchiveMoves } from "./ArchiveMoves";
import { BoardLayout } from "../../shared/board-layout";
import { Chess } from "chess.js";
import { Board, boardPosition, Square } from "../../entities/board";

interface Props {
  fen?: string;
  steps: readonly [string, string][];
  side: "w" | "b";
  puzzle?: boolean;
  onAttempt?: (wrong: boolean, solved: boolean) => void;
  onRestart?: () => void;
  context: React.ReactNode;
  next?: React.ReactNode;
}

export function Trainer({ fen, steps, side, puzzle, context, next, onAttempt, onRestart }: Props) {
  const { language, t } = useLanguage();
  const [ply, advance] = useState(0);
  const [selected, select] = useState<Square>();
  const [hint, showHint] = useState(false);
  const [feedback, say] = useState<{ kind: "correct"; ply: number; san: string } | { kind: "illegal" | "different"; ply: number }>();
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
      onAttempt?.(false, true);
      setOtherMate(move.san); return;
    }
    if (!move || move.lan !== target?.lan) {
      onAttempt?.(true, false);
      say({ kind: move ? "different" : "illegal", ply });
      return;
    }
    onAttempt?.(false, ply + 2 >= steps.length);
    say({ kind: "correct", ply, san: move.san });
    showHint(false);
    advance(ply + 1);
  }
  function click(square: Square) {
    promote(undefined);
    if (state.get(square)?.color === side) { select(selected === square ? undefined : square); return; }
    if (selected) attempt(square);
  }
  function feedbackText() {
    if (otherMate) return t("Мат. Решение верно.", "Checkmate. Correct solution.");
    if (!feedback) return "";
    const explanation = steps[feedback.ply][1];
    if (feedback.kind === "correct") return t("Верно, ", "Correct, ") + feedback.san + ". " + explanation;
    const message = feedback.kind === "different"
      ? t("Допустимый ход, но в этой линии нужен другой.", "Legal move, but this line calls for another move.")
      : t("Так пойти нельзя.", "That move is illegal.");
    return message + " " + (puzzle ? t("Попробуйте ещё раз.", "Try again.") : explanation);
  }
  return <BoardLayout lang={language} context={context} board={<Board position={boardPosition(state)} flipped={side === "b"} lastMove={lastMove} selected={selected}
      targets={hint && target && !complete ? [target.from, target.to] : []}
      movableColor={side === "w" ? "white" : "black"}
      onMove={automatic || complete ? undefined : (from, to) => attempt(to, undefined, from)}
      onSquare={automatic || complete ? undefined : click} />}
    status={<>
      <h2>{complete ? (puzzle ? t("Задача решена", "Puzzle solved") : t("Линия пройдена", "Line completed")) : automatic ? t("Ответ соперника", "Opponent’s reply") : t("Ваш ход", "Your turn")}</h2>
      <p>{side === "w" ? t("Вы играете белыми", "You play White") : t("Вы играете чёрными", "You play Black")}</p>
    </>} actions={<>
      <p aria-live="polite">{feedbackText()}</p>
      {!puzzle && lastMove && lastMove.color !== side && <p>{t("Ответ", "Reply")} {lastMove.san}. {steps[ply - 1][1]}</p>}
      {!complete && !automatic && <button onClick={() => showHint(true)}>{t("Показать ход", "Show move")}</button>}
      {hint && target && !complete && <p>{target.san} · {target.from} → {target.to}. {expected[1]}</p>}
      {promotion && <div>{(["q","r","b","n"] as const).map((p,i) =>
        <button key={p} onClick={() => attempt(promotion, p)}>{[t("Ферзь", "Queen"), t("Ладья", "Rook"), t("Слон", "Bishop"), t("Конь", "Knight")][i]}</button>)}</div>}
      {history.length > 0 && <p aria-label={t("Сыгранные ходы", "Moves played")}>{state.pgn({ newline: " " }).replace(/\[[^\]]*\]/g, "").replace(/\s*\*$/, "").trim()}</p>}
      <button onClick={() => { onRestart?.(); advance(0); select(undefined); showHint(false); say(undefined); promote(undefined); setOtherMate(""); }}>{t("Начать заново", "Restart")}</button>
      {!puzzle && <ArchiveMoves prefix={history.map(move => move.lan).join(",")} />}
      {next}
    </>} />;
}
