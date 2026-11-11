import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../shared/language";
import { classifyMove, moveLoss } from "./moveQuality";
import type { Game } from "../../features/play";

export interface PositionScore { value: number; label: string; best?: string; bestUci?: string; legalCount?: number; alternativeGap?: number }

function positionScore(data: { cp?: number; mate?: number; outcome?: string; line?: string[]; best_uci?: string; legal_count?: number; alternative_gap?: number | null }): PositionScore {
  if (data.outcome === "1-0") return { value: 100000, label: "1–0" };
  if (data.outcome === "0-1") return { value: -100000, label: "0–1" };
  if (data.outcome === "1/2-1/2") return { value: 0, label: "½–½" };
  if (typeof data.mate === "number") return { value: Math.sign(data.mate) * (100000 - Math.abs(data.mate)), label: "#" + data.mate, best: data.line?.[0], bestUci: data.best_uci, legalCount: data.legal_count, alternativeGap: data.alternative_gap ?? undefined };
  if (typeof data.cp !== "number" || !Number.isFinite(data.cp)) throw Error();
  return { value: data.cp, label: (data.cp > 0 ? "+" : "") + (data.cp / 100).toFixed(2), best: data.line?.[0], bestUci: data.best_uci, legalCount: data.legal_count, alternativeGap: data.alternative_gap ?? undefined };
}

export function GameReport({ game, ply, select, practise, scores, setScores }: { game: Game; ply: number; select: (ply: number) => void; practise: (ply: number) => void; scores: PositionScore[]; setScores: React.Dispatch<React.SetStateAction<PositionScore[]>> }) {
  const { t } = useLanguage();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const request = useRef<AbortController>();
  useEffect(() => () => request.current?.abort(), []);
  const done = scores.length === game.moves.length + 1;
  async function analyse() {
    if (request.current) return;
    const abort = new AbortController();
    request.current = abort;
    setState("running");
    try {
      for (let i = scores.length; i <= game.moves.length; i++) {
        const response = await fetch("/api/games/" + encodeURIComponent(game.id) + "/analysis?compare=true&engine=" + (game.engine_name ?? "lc0") + "&ply=" + i, { signal: abort.signal });
        if (!response.ok) throw Error();
        const score = positionScore(await response.json());
        if (abort.signal.aborted) return;
        setScores(previous => [...previous, score]);
      }
      setState("idle");
    } catch { if (!abort.signal.aborted) setState("error"); }
    finally { if (request.current === abort) request.current = undefined; }
  }
  const moments = scores.slice(1).map((after, i) => ({
    ply: i + 1, loss: moveLoss(scores[i], after, i + 1),
    quality: classifyMove(scores[i], after, i + 1, game.moves[i]),
  })).filter(moment => moment.quality === "mistake").sort((a, b) => b.loss - a.loss).slice(0, 3);
  const before = scores[ply - 1], after = scores[ply];
  return <section aria-label={t("Подробный разбор", "Game review", "Revisión de la partida")}><h3>{t("Разбор всей партии", "Full game review", "Análisis completo de la partida")}</h3>
    {!done && <button onClick={state === "running" ? () => { request.current?.abort(); request.current = undefined; setState("idle"); } : analyse}>
      {state === "running" ? t("Приостановить", "Pause", "Pausar") : scores.length ? t("Продолжить разбор", "Resume review", "Continuar el análisis") : t("Найти ключевые моменты", "Find key moments", "Buscar momentos clave")}</button>}
    {(scores.length > 0 || state === "running") && <p>{t("Проверено позиций", "Positions evaluated", "Posiciones evaluadas")}: {scores.length}/{game.moves.length + 1}</p>}
    {state === "error" && <p role="alert">{t("Расчёт прерван. Можно повторить с этой позиции.", "Analysis interrupted. Retry from this position.", "Se ha interrumpido el análisis. Puedes continuar desde esta posición.")}</p>}
    {done && !moments.length && <p>{t("Движок не нашёл заметных потерь оценки.", "The engine found no substantial evaluation losses.", "El motor no ha encontrado jugadas que empeoren significativamente la posición.")}</p>}
    {moments.length > 0 && <><strong>{t("Ключевые моменты", "Key moments", "Momentos clave")}</strong><div>{moments.map(moment =>
      <div key={moment.ply}><button aria-pressed={ply === moment.ply} onClick={() => select(moment.ply)}>
        {Math.ceil(moment.ply / 2)}{moment.ply % 2 ? ". " : "… "}{game.moves[moment.ply - 1]}</button>
        {scores[moment.ply - 1].bestUci && <button onClick={() => practise(moment.ply)}>{t("Решить самостоятельно", "Try unaided", "Resolver sin ayuda")}</button>}
      </div>)}</div></>}
    {before && after && <p>{t("Оценка за белых до и после хода", "White’s evaluation before and after the move", "Evaluación para las blancas antes y después de la jugada")}: {before.label} → {after.label}.
      {before.best && before.best !== game.moves[ply - 1] && <> {t("Движок предлагал", "Engine preference", "Jugada recomendada por el motor")}: {before.best}.</>}</p>}
    {before && after && <p>{t("Плюс — преимущество белых, минус — чёрных. Одна единица примерно равна пешке. Знак # означает форсированный мат.", "Positive values favour White and negative values favour Black. One point is about one pawn. # indicates forced mate.", "Los valores positivos favorecen a las blancas y los negativos a las negras. Un punto equivale aproximadamente a un peón. El signo # indica mate forzado.")}</p>}
    {before && game.chess960 == null && <a href={"?section=analysis&game=" + game.id + "&ply=" + (ply - 1)}>{t("Попробовать другой ход", "Try a different move", "Probar otra jugada")}</a>}
  </section>;
}
