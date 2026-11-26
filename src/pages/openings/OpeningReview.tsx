import { Chess } from "chess.js";
import React, { useEffect, useRef, useState } from "react";
import { Trainer } from "../../features/training";
import { useLanguage } from "../../shared/language";
import { lessonsByLanguage } from "./lessons";

interface Review {
  fen: string; side: "w" | "b"; san: string; chapter: string; chapter_name: string | null;
  line: number; ply: number; more: boolean; due_at: number; expected: string;
}

export function OpeningReview() {
  const { language, t } = useLanguage();
  const [offset, setOffset] = useState(0);
  const [revision, refresh] = useState(0);
  const [review, setReview] = useState<Review | null>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setReview(undefined);
      setFailed(false);
      const res = await fetch("/api/openings/positions?offset=" + offset, { signal: abort.signal, cache: "no-store" });
      if (!res.ok) throw Error();
      const { position, more } = await res.json();
      if (abort.signal.aborted) return;
      if (typeof more !== "boolean") throw Error();
      if (position === null) { setReview(null); return; }
      if (typeof position.fen !== "string" || typeof position.expected !== "string" ||
          typeof position.chapter !== "string" || !(position.chapter_name === null || typeof position.chapter_name === "string") ||
          !Number.isSafeInteger(position.due_at) || !Number.isSafeInteger(position.line) || !Number.isSafeInteger(position.ply)) throw Error();
      const board = new Chess(position.fen);
      if (board.turn() !== position.side) throw Error();
      const san = board.move(position.expected).san;
      setReview({ ...position, more, san });
    }
    load().catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [offset, revision]);
  const back = new URLSearchParams(location.search);
  back.delete("review");
  const title = t("Повторить сегодня", "Review today", "Repasar hoy");
  const context = <>
    <a href={"?" + back}>{t("К тренажёру дебютов", "Back to opening trainer", "Volver al entrenador de aperturas")}</a>
    {review && <p>{review.chapter_name ?? lessonsByLanguage[language].find(item => item.id === review.chapter)?.name ??
      t("Дебют", "Opening", "Apertura")} · {t("Вариант", "Line", "Variante")} {review.line + 1} · {t("Полуход", "Half-move", "Media jugada")} {review.ply + 1}</p>}
  </>;
  const previous = offset > 0 && <button onClick={() => setOffset(offset - 1)}>{t("Предыдущая позиция", "Previous position", "Posición anterior")}</button>;
  if (!review) return <main lang={language} className="atlas-page"><h1>{title}</h1><section className="atlas-card">{context}
    {failed ? <p role="alert">{t("Не удалось загрузить позицию.", "Could not load the position.", "No se pudo cargar la posición.")} <button onClick={() => refresh(n => n + 1)}>{t("Повторить", "Retry", "Reintentar")}</button></p> :
      <p role="status">{review === null ? t("Нет позиций для повторения.", "No positions to review.", "No hay posiciones para repasar.") : t("Загрузка…", "Loading…", "Cargando…")}</p>}
    {previous}{review === null && <button onClick={() => refresh(n => n + 1)}>{t("Обновить", "Refresh", "Actualizar")}</button>}</section></main>;
  return <ReviewBoard key={offset + ":" + revision} review={review} context={context} previous={previous}
    skip={() => setOffset(offset + 1)} advance={() => { setOffset(0); refresh(n => n + 1); }} />;
}

interface BoardProps {
  review: Review; context: React.ReactNode; previous: React.ReactNode; skip: () => void; advance: () => void;
}

function ReviewBoard({ review, context, previous, skip, advance }: BoardProps) {
  const { language, t } = useLanguage();
  const firstAnswer = useRef<boolean>();
  const [status, setStatus] = useState<"idle" | "saving" | "failed" | "saved">("idle");
  const [due, setDue] = useState(0);
  async function save(correct: boolean) {
    firstAnswer.current = correct;
    setStatus("saving");
    try {
      const { chapter, line, ply, fen, expected, side, due_at } = review;
      const response = await fetch("/api/openings/review", { method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapter, line, ply, fen, expected, side, due_at, correct }) });
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!Number.isSafeInteger(result.due_at) || result.due_at <= due_at) throw Error();
      setDue(result.due_at);
      setStatus("saved");
    } catch { setStatus("failed"); }
  }
  return <Trainer title={t("Повторить сегодня", "Review today", "Repasar hoy")} fen={review.fen} side={review.side} steps={[[review.san, ""]]} context={context}
    onAttempt={wrong => { if (firstAnswer.current === undefined) void save(!wrong); }}
    next={<>
      {status === "failed" && <p role="alert">{t("Расписание не сохранено.", "Could not save the schedule.", "No se pudo guardar el calendario.")} <button onClick={() => void save(firstAnswer.current!)}>{t("Повторить", "Retry", "Reintentar")}</button></p>}
      {status === "saving" && <p role="status">{t("Сохраняем результат…", "Saving result…", "Guardando el resultado…")}</p>}
      {status === "saved" && <><p role="status">{t("Следующее повторение", "Next review", "Próximo repaso")} · {new Date(due * 1000).toLocaleString(language)}</p>
        <button onClick={advance}>{t("Продолжить повторение", "Continue review", "Continuar el repaso")}</button></>}
      {status === "idle" && <>{previous}{review.more && <button onClick={skip}>{t("Следующая позиция", "Next position", "Posición siguiente")}</button>}</>}
    </>} />;
}
