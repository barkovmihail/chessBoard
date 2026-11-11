import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Trainer } from "../../features/training";

interface Puzzle {
  id: string;
  rating: number;
  fen: string;
  side: "w" | "b";
  steps: [string, string][];
}

export function PuzzlesPage() {
  const [sequence, next] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setPuzzle(undefined);
    setError(false);
    async function load() {
      const response = await fetch("/api/puzzles/random", { signal: abort.signal, cache: "no-store" });
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      const board = new Chess(data.fen);
      board.move(data.moves[0]);
      const fen = board.fen();
      const side = board.turn();
      const steps: [string, string][] = data.moves.slice(1).map((uci: string) => [board.move(uci).san, ""]);
      if (!steps.length) throw new Error("empty");
      if (!abort.signal.aborted) setPuzzle({ id: data.puzzle_id, rating: data.rating, fen, side, steps });
    }
    load().catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [sequence]);
  const title = <h1>Шахматные задачи</h1>;
  const button = <button onClick={() => next(sequence + 1)} disabled={!error && !puzzle}>
    {error ? "Повторить загрузку" : "Следующая задача"}
  </button>;
  if (!puzzle) return <main className="study-page">{title}
    <p role="status">{error ? "Не удалось загрузить задачу из каталога." : "Загружаем позицию…"}</p>{button}
  </main>;
  return <Trainer key={sequence} fen={puzzle.fen} steps={puzzle.steps} side={puzzle.side} puzzle
    context={<>{title}<p>Задача {puzzle.id} · Рейтинг {puzzle.rating}</p></>} next={button} />;
}
