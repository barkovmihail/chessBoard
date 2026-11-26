import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import { panelStyles } from "../../shared/page-panels";
import { loadPuzzle, type Puzzle } from "./loadPuzzle";
import styles from "./history.module.css";

interface Entry { id: string; puzzle: string; started: number; mistakes: number; solved: boolean }

export function AttemptHistory({ revision, onReplay, fullPage = false }: { revision: number; onReplay: (id: string) => void; fullPage?: boolean }) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(fullPage);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{ items: Entry[]; more: boolean }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setError(false);
    setPage(undefined);
    fetch("/api/puzzles/attempts?offset=" + offset, { signal: abort.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (typeof data.more !== "boolean" || !Array.isArray(data.items) ||
            !data.items.every((row: Entry) => row && typeof row.id === "string" && typeof row.puzzle === "string" &&
              Number.isSafeInteger(row.started) && Number.isSafeInteger(row.mistakes) && typeof row.solved === "boolean")) throw Error();
        if (!abort.signal.aborted) setPage(data);
      }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [open, offset, revision, retry]);
  const title = t("История попыток", "Attempt history", "Historial de intentos");
  const rows = page?.items ?? [];
  const solved = rows.filter(row => row.solved).length;
  const repeat = rows.find(row => row.mistakes > 0)?.puzzle ?? rows[0]?.puzzle;
  const ledger = error ? <button onClick={() => setRetry(retry + 1)}>{t("Повторить загрузку истории", "Retry loading history", "Volver a cargar el historial")}</button> : !page ?
      <p role="status">{t("Загружаем историю…", "Loading history…", "Cargando el historial…")}</p> : <>
        {!rows.length && <p>{t("Пока нет попыток.", "No attempts yet.", "Todavía no hay intentos.")}</p>}
        {fullPage && rows.length > 0 && <dl className={styles.totals}>
          <div><dt>{t("Попыток на странице", "Attempts on this page", "Intentos en esta página")}</dt><dd>{rows.length}</dd></div>
          <div><dt>{t("Решено", "Solved", "Resueltos")}</dt><dd>{solved}</dd></div>
          <div><dt>{t("Без ошибок", "Solved without mistakes", "Resueltos sin errores")}</dt><dd>{rows.filter(row => row.solved && !row.mistakes).length}</dd></div>
        </dl>}
        <ol className={styles.ledger} start={offset + 1}>{rows.map(row => <li key={row.id}>
          <div><strong>{t("Задача", "Puzzle", "Problema")} {row.puzzle}</strong> · {row.solved ? t("Решена", "Solved", "Resuelto") : t("Не завершена", "Unfinished", "Sin terminar")} · {t("Ошибок", "Mistakes", "Errores")} {row.mistakes}
            <small><time dateTime={new Date(row.started).toISOString()}>{new Date(row.started).toLocaleString(language)}</time></small></div>
          {row.mistakes > 0 && <button onClick={() => onReplay(row.puzzle)}>{t("Решить снова", "Solve again", "Resolver de nuevo")}</button>}
        </li>)}</ol>
        {offset > 0 && <button onClick={() => setOffset(offset - 20)}>{t("Предыдущие попытки", "Previous attempts", "Intentos anteriores")}</button>}
        {page.more && <button onClick={() => setOffset(offset + 20)}>{t("Следующие попытки", "Next attempts", "Intentos siguientes")}</button>}
      </>;
  if (fullPage) return <main className="atlas-page" lang={language}><h1>{title}</h1>
    <div className="atlas-columns"><section className="atlas-card"><h2>{t("Последние попытки", "Recent attempts", "Intentos recientes")}</h2>
      {ledger}<a href="?section=puzzles">{t("Решать задачи", "Solve puzzles", "Resolver problemas")}</a></section>
      <aside className={`atlas-card ${panelStyles.boardPreview}`}><h2>{t("Повторение", "Practice again", "Repaso")}</h2>
        {repeat ? <PuzzlePreview key={repeat} id={repeat} onReplay={onReplay} /> :
          <p>{t("Здесь появится позиция из вашей истории.", "A position from your history will appear here.", "Aquí aparecerá una posición de tu historial.")}</p>}
      </aside></div></main>;
  const params = new URLSearchParams(location.search);
  params.set("view", "history");
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>{title}</summary>
    {open && <>{ledger}<a href={"?" + params}>{t("Открыть журнал решений", "Open attempt log", "Abrir registro de intentos")}</a></>}</details>;
}

function PuzzlePreview({ id, onReplay }: { id: string; onReplay: (id: string) => void }) {
  const { t } = useLanguage();
  const [puzzle, setPuzzle] = useState<Puzzle>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    loadPuzzle(abort.signal, id).then(data => {
      if (!abort.signal.aborted) setPuzzle(data);
    }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [id]);
  if (!puzzle) return <p role="status">{failed ? t("Позиция недоступна.", "Position unavailable.", "Posición no disponible.") : t("Загружаем позицию…", "Loading position…", "Cargando la posición…")}</p>;
  return <><Board position={boardPosition(new Chess(puzzle.fen))} flipped={puzzle.side === "b"} />
    <strong>{t("Задача", "Puzzle", "Problema")} {id}</strong>
    <p>{puzzle.side === "w" ? t("Ход белых", "White to move", "Juegan blancas") : t("Ход чёрных", "Black to move", "Juegan negras")} · {puzzle.rating}</p>
    <button className="atlas-primary" onClick={() => onReplay(id)}>{t("Перейти к задаче", "Open puzzle", "Abrir problema")}</button></>;
}
