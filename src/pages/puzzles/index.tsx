import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { AttemptHistory } from "./AttemptHistory";
import { commandId } from "../../shared/commandId";
import { Chess } from "chess.js";
import { Trainer } from "../../features/training";

interface Puzzle {
  id: string;
  rating: number;
  fen: string;
  side: "w" | "b";
  steps: [string, string][];
}

interface Progress { id: string; puzzle: string; mistakes: number; solved: boolean }

export function PuzzlesPage() {
  const { language, t } = useLanguage();
  const attempt = useRef<Progress | null>(null);
  const [failed, setFailed] = useState<Progress[]>([]);
  const [pending, setPending] = useState(0);
  const [revision, setRevision] = useState(0);
  async function save(entry: Progress) {
    setPending(n => n + 1);
    try {
      const response = await fetch("/api/puzzles/attempts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry), keepalive: true });
      if (!response.ok) throw Error();
      setRevision(n => n + 1);
    } catch {
      setFailed(entries => [...entries, entry]);
    } finally {
      setPending(n => n - 1);
    }
  }
  function record(wrong: boolean, solved: boolean) {
    if (!puzzle) return;
    const prior = attempt.current;
    const entry = { id: prior?.id ?? commandId(), puzzle: puzzle.id, mistakes: (prior?.mistakes ?? 0) + Number(wrong), solved };
    attempt.current = entry;
    void save(entry);
  }
  const [theme, setTheme] = useState("");
  const [sequence, next] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle>();
  const [error, setError] = useState<"empty" | "load" | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    attempt.current = null;
    setPuzzle(undefined);
    setError(null);
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
      if (!abort.signal.aborted) setError(reason.message === "empty-theme" ? "empty" : "load");
    });
    return () => abort.abort();
  }, [sequence, theme]);
  const title = <><h1>{t("Шахматные задачи", "Puzzles")}</h1>
    <label>{t("Тема задачи", "Puzzle theme")} <select value={theme} onChange={e => setTheme(e.target.value)}>
      <option value="">{t("Все темы", "All themes")}</option><option value="mateIn1">{t("Мат в один ход", "Mate in one")}</option>
      <option value="mateIn2">{t("Мат в два хода", "Mate in two")}</option><option value="fork">{t("Вилка", "Fork")}</option>
      <option value="pin">{t("Связка", "Pin")}</option><option value="endgame">{t("Эндшпиль", "Endgame")}</option>
    </select></label>
    <AttemptHistory revision={revision} />
    {failed.length > 0 ? <p role="alert">{t("История не сохранена.", "History could not be saved.")} <button onClick={() => { setFailed([]); failed.forEach(entry => void save(entry)); }}>{t("Повторить сохранение", "Retry saving")}</button></p> :
      pending > 0 && <p role="status">{t("Сохраняем попытку…", "Saving attempt…")}</p>}
  </>;
  const button = <button onClick={() => next(sequence + 1)} disabled={!error && !puzzle}>
    {error ? t("Повторить загрузку", "Retry loading") : t("Следующая задача", "Next puzzle")}
  </button>;
  if (!puzzle) return <main lang={language} className="study-page">{title}
    <p role="status">{error === "empty" ? t("По этой теме нет задач. Выберите другую тему.", "No puzzles for this theme. Choose another theme.") : error === "load" ? t("Не удалось загрузить задачу из каталога.", "Could not load the puzzle.") : t("Загружаем позицию…", "Loading position…")}</p>{button}
  </main>;
  return <Trainer key={puzzle.id + sequence} fen={puzzle.fen} onAttempt={record} onRestart={() => { attempt.current = null; }} steps={puzzle.steps} side={puzzle.side} puzzle
    context={<>{title}<p>{t("Задача", "Puzzle")} {puzzle.id} · {t("Рейтинг", "Rating")} {puzzle.rating}</p></>} next={button} />;
}
