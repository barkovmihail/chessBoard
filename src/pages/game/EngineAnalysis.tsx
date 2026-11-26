import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";

type Engine = "lc0" | "stockfish";

type Score = { kind: "mate"; moves: number } | { kind: "score"; text: string };

function readScore(data: { outcome?: string; cp?: number; mate?: number }): Score {
  if (data.outcome && ["1-0", "0-1", "1/2-1/2"].includes(data.outcome)) return { kind: "score", text: data.outcome };
  if (typeof data.mate === "number" && Number.isInteger(data.mate)) return { kind: "mate", moves: data.mate };
  if (typeof data.cp !== "number" || !Number.isInteger(data.cp)) throw Error();
  return { kind: "score", text: (data.cp > 0 ? "+" : "") + (data.cp / 100).toFixed(2) };
}

function Evaluation({ id, ply, engine }: { id: string; ply: number; engine: Engine }) {
  const { t } = useLanguage();
  const [result, setResult] = useState<{ score: Score; line: string[] } | "error">();
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/games/" + encodeURIComponent(id) + "/analysis?ply=" + ply + "&engine=" + engine,
      { signal: abort.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!Array.isArray(data.line) || !data.line.every((s: unknown) => typeof s === "string")) throw Error();
      const score = readScore(data);
      if (!abort.signal.aborted) setResult({ score, line: data.line });
    }).catch(() => { if (!abort.signal.aborted) setResult("error"); });
    return () => abort.abort();
  }, [id, ply, engine]);
  if (!result) return <p role="status">{t("Расчёт…", "Calculating…", "Calculando…")}</p>;
  if (result === "error") return <p role="status">{t("Движок недоступен. Попробуйте ещё раз.", "Engine unavailable. Try again.", "El motor no está disponible. Inténtalo de nuevo.")}</p>;
  const { score, line } = result;
  const text = score.kind === "score" ? score.text : t("мат в ", "mate in ", "mate en ") + Math.abs(score.moves) +
    (score.moves > 0 ? t(" за белых", " for White", " para las blancas") : t(" за чёрных", " for Black", " para las negras"));
  return <p role="status">{t("Оценка за белых", "Evaluation for White", "Evaluación desde el punto de vista de las blancas")} {text}{line.length > 0 && " · " + line.join(" ")}</p>;
}

export function EngineAnalysis({ id, ply, initial }: { id: string; ply: number; initial: Engine }) {
  const { language, t } = useLanguage();
  const [engine, setEngine] = useState(initial);
  const [active, setActive] = useState(false);
  return <fieldset lang={language}><legend>{t("Анализ позиции", "Position analysis", "Análisis de la posición")}</legend>
    <label>{t("Движок анализа", "Analysis engine", "Motor de análisis")} <select value={engine} onChange={e => setEngine(e.target.value === "lc0" ? "lc0" : "stockfish")}>
      <option value="lc0">Leela Chess Zero</option><option value="stockfish">Stockfish</option>
    </select></label>
    <button onClick={() => setActive(!active)}>{active ? t("Остановить анализ", "Stop analysis", "Detener el análisis") : t("Оценить позицию", "Evaluate position", "Evaluar la posición")}</button>
    {active && <Evaluation key={id + ply + engine} id={id} ply={ply} engine={engine} />}
  </fieldset>;
}
