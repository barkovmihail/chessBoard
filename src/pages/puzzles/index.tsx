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
  const [theme, setTheme] = useState("");
  const [sequence, next] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle>();
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setPuzzle(undefined);
    setError("");
    async function load() {
      const response = await fetch("/api/puzzles/random" + (theme ? "?theme=" + theme : ""), { signal: abort.signal, cache: "no-store" });
      if (response.status === 404) throw new Error("empty-theme");
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
    load().catch(reason => {
      if (!abort.signal.aborted) setError(reason.message === "empty-theme" ?
        "По этой теме нет задач. Выберите другую тему." : "Не удалось загрузить задачу из каталога.");
    });
    return () => abort.abort();
  }, [sequence, theme]);
  const title = <><h1>Шахматные задачи</h1>
    <label>Тема задачи <select value={theme} onChange={e => setTheme(e.target.value)}>
      <option value="">Все темы</option><option value="mateIn1">Мат в один ход</option>
      <option value="mateIn2">Мат в два хода</option><option value="fork">Вилка</option>
      <option value="pin">Связка</option><option value="endgame">Эндшпиль</option>
    </select></label></>;
  const button = <button onClick={() => next(sequence + 1)} disabled={!error && !puzzle}>
    {error ? "Повторить загрузку" : "Следующая задача"}
  </button>;
  if (!puzzle) return <main className="study-page">{title}
    <p role="status">{error || "Загружаем позицию…"}</p>{button}
  </main>;
  return <Trainer key={puzzle.id + sequence} fen={puzzle.fen} steps={puzzle.steps} side={puzzle.side} puzzle
    context={<>{title}<p>Задача {puzzle.id} · Рейтинг {puzzle.rating}</p></>} next={button} />;
}
