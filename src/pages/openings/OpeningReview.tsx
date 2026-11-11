import { Chess } from "chess.js";
import React, { useEffect, useState } from "react";
import { Trainer } from "../../features/training";
import { useLanguage } from "../../shared/language";
import { lessonsByLanguage } from "./lessons";

interface Review {
  fen: string; side: "w" | "b"; san: string; chapter: string; chapter_name: string | null;
  line: number; ply: number; more: boolean;
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
          !Number.isSafeInteger(position.line) || !Number.isSafeInteger(position.ply)) throw Error();
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
  const context = <><h1>{t("Повторить сегодня", "Review today", "Repasar hoy")}</h1>
    <a href={"?" + back}>{t("К тренажёру дебютов", "Back to opening trainer", "Volver al entrenador de aperturas")}</a>
    {review && <p>{review.chapter_name ?? lessonsByLanguage[language].find(item => item.id === review.chapter)?.name ??
      t("Дебют", "Opening", "Apertura")} · {t("Вариант", "Line", "Variante")} {review.line + 1} · {t("Полуход", "Half-move", "Media jugada")} {review.ply + 1}</p>}
  </>;
  const previous = offset > 0 && <button onClick={() => setOffset(offset - 1)}>{t("Предыдущая позиция", "Previous position", "Posición anterior")}</button>;
  if (!review) return <main lang={language} className="study-page">{context}
    {failed ? <p role="alert">{t("Не удалось загрузить позицию.", "Could not load the position.", "No se pudo cargar la posición.")} <button onClick={() => refresh(n => n + 1)}>{t("Повторить", "Retry", "Reintentar")}</button></p> :
      <p role="status">{review === null ? t("Нет позиций для повторения.", "No positions to review.", "No hay posiciones para repasar.") : t("Загрузка…", "Loading…", "Cargando…")}</p>}
    {previous}</main>;
  return <Trainer key={offset} fen={review.fen} side={review.side} steps={[[review.san, ""]]} context={context}
    next={<>{previous}{review.more && <button onClick={() => setOffset(offset + 1)}>{t("Следующая позиция", "Next position", "Posición siguiente")}</button>}</>} />;
}
