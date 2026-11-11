import React from "react";
import { useLanguage } from "../../shared/language";
import type { PositionScore } from "./GameReport";
import styles from "./game.module.css";

export function EvaluationChart({ moves, scores, ply, select }: {
  moves: string[]; scores: PositionScore[]; ply: number; select: (value: number) => void;
}) {
  const { t } = useLanguage();
  if (!scores.length) return null;
  const last = scores.length - 1;
  const x = (i: number) => 100 * i / Math.max(1, moves.length);
  const y = (score: number) => 50 - Math.max(-500, Math.min(500, score)) / 10;
  const title = t("График оценки за белых", "Evaluation chart for White", "Gráfico de evaluación para las blancas");
  function description(index: number) {
    const move = index ? Math.ceil(index / 2) + (index % 2 ? ". " : "… ") + moves[index - 1] :
      t("Начальная позиция", "Starting position", "Posición inicial");
    return move + " · " + (scores[index]?.label ?? t("Ожидает расчёта", "Awaiting evaluation", "Pendiente de evaluación"));
  }
  return <figure className={styles.timeChart}>
    <figcaption>{title}</figcaption>
    <div className={styles.evalPlot}>
      <div aria-hidden="true"><span>+5</span><span>0</span><span>−5</span></div>
      <div className={styles.evalInput}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 50 H100" stroke="var(--edge)" vectorEffect="non-scaling-stroke" />
          <polyline points={scores.map((s, i) => x(i) + "," + y(s.value)).join(" ")} fill="none"
            stroke="var(--ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={`M${x(ply)} 0 V100`} stroke="var(--link)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <input type="range" aria-label={title} aria-valuetext={description(ply)} min={0} max={moves.length}
          value={ply} disabled={!moves.length} onChange={e => select(Number(e.target.value))} />
      </div>
    </div>
    <output>{description(ply)}</output>
    {last < moves.length && <small> · {t("Проверено позиций", "Positions evaluated", "Posiciones evaluadas")} {scores.length}/{moves.length + 1}</small>}
  </figure>;
}
