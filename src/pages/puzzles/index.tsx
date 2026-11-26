import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { usePuzzleThemes } from "../../shared/puzzle-themes";
import { AttemptHistory } from "./AttemptHistory";
import { commandId } from "../../shared/commandId";
import { loadPuzzle, type Puzzle } from "./loadPuzzle";
import { Trainer } from "../../features/training";

interface Progress { id: string; puzzle: string; mistakes: number; solved: boolean }

export function PuzzlesPage() {
  const params = new URLSearchParams(location.search);
  if (params.get("view") === "history") return <AttemptHistory fullPage revision={0} onReplay={id => {
    params.delete("view");
    params.set("puzzle", id);
    location.assign("?" + params);
  }} />;
  return <PuzzleSession />;
}

function PuzzleSession() {
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
  const themes = usePuzzleThemes();
  const [theme, setTheme] = useState(() => {
    const selected = new URLSearchParams(location.search).get("theme") ?? "";
    return Object.prototype.hasOwnProperty.call(themes, selected) ? selected : "";
  });
  const [replayId, setReplayId] = useState<string | undefined>(() => new URLSearchParams(location.search).get("puzzle") || undefined);
  function selectPuzzle(id?: string, nextTheme = theme) {
    const url = new URL(location.href);
    if (id) url.searchParams.set("puzzle", id);
    else url.searchParams.delete("puzzle");
    if (nextTheme) url.searchParams.set("theme", nextTheme);
    else url.searchParams.delete("theme");
    history.replaceState(history.state, "", url);
    setReplayId(id);
    setTheme(nextTheme);
  }
  const [sequence, next] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle>();
  const [error, setError] = useState<"empty" | "missing" | "load" | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    attempt.current = null;
    setPuzzle(undefined);
    setError(null);
    loadPuzzle(abort.signal, replayId, theme).then(data => {
      if (!abort.signal.aborted) setPuzzle(data);
    }).catch(reason => {
      if (!abort.signal.aborted) setError(reason.message === "empty-theme" ? "empty" : reason.message === "missing" ? "missing" : "load");
    });
    return () => abort.abort();
  }, [sequence, theme, replayId]);
  const title = t("Шахматные задачи", "Puzzles", "Problemas de ajedrez");
  const settings = <details><summary>{t("Выбор темы", "Choose theme", "Elegir tema")} · {themes[theme]}</summary>
      <label>{t("Тема задачи", "Puzzle theme", "Tema del problema")} <select value={theme} onChange={e => selectPuzzle(undefined, e.target.value)}>
        {Object.entries(themes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </details>;
  const controls = <>
    <AttemptHistory revision={revision} onReplay={id => { selectPuzzle(id); next(n => n + 1); }} />
    {failed.length > 0 ? <p role="alert">{t("История не сохранена.", "History could not be saved.", "No se pudo guardar el historial.")} <button onClick={() => { setFailed([]); failed.forEach(entry => void save(entry)); }}>{t("Повторить сохранение", "Retry saving", "Volver a guardar")}</button></p> :
      pending > 0 && <p role="status">{t("Сохраняем попытку…", "Saving attempt…", "Guardando el intento…")}</p>}
  </>;
  const button = <button onClick={() => { if (error !== "load") selectPuzzle(); next(n => n + 1); }} disabled={!error && !puzzle}>
    {error && error !== "missing" ? t("Повторить загрузку", "Retry loading", "Volver a cargar") : t("Следующая задача", "Next puzzle", "Siguiente problema")}
  </button>;
  if (!puzzle) return <main lang={language} className="atlas-page"><h1>{title}</h1><section className="atlas-card">{settings}{controls}
    <p role="status">{error === "missing" ? t("Этой задачи больше нет в каталоге.", "This puzzle is no longer in the catalogue.", "Este problema ya no está en el catálogo.") : error === "empty" ? t("По этой теме нет задач. Выберите другую тему.", "No puzzles for this theme. Choose another theme.", "No hay problemas de este tema. Elige otro.") : error === "load" ? t("Не удалось загрузить задачу из каталога.", "Could not load the puzzle.", "No se pudo cargar el problema.") : t("Загружаем позицию…", "Loading position…", "Cargando la posición…")}</p>{button}
  </section></main>;
  return <Trainer title={title} settings={settings} key={puzzle.id + sequence} fen={puzzle.fen} onAttempt={record} onRestart={() => { attempt.current = null; }} steps={puzzle.steps} side={puzzle.side} puzzle themeLabel={replayId ? undefined : themes[theme]}
    context={<><p>{t("Задача", "Puzzle", "Problema")} {puzzle.id} · {t("Рейтинг", "Rating", "Puntuación")} {puzzle.rating}</p>{controls}</>} next={button} />;
}
