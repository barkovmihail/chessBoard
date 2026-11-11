import React, { useEffect, useState } from "react";

type Engine = "lc0" | "stockfish";

function formatScore(data: { outcome?: string; cp?: number; mate?: number }) {
  if (data.outcome && ["1-0", "0-1", "1/2-1/2"].includes(data.outcome)) return data.outcome;
  if (typeof data.mate === "number" && Number.isInteger(data.mate))
    return "мат в " + Math.abs(data.mate) + (data.mate > 0 ? " за белых" : " за чёрных");
  if (typeof data.cp !== "number" || !Number.isInteger(data.cp)) throw Error();
  return (data.cp > 0 ? "+" : "") + (data.cp / 100).toFixed(2);
}

function Evaluation({ id, ply, engine }: { id: string; ply: number; engine: Engine }) {
  const [text, setText] = useState("Расчёт…");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/games/" + encodeURIComponent(id) + "/analysis?ply=" + ply + "&engine=" + engine,
      { signal: abort.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!Array.isArray(data.line) || !data.line.every((s: unknown) => typeof s === "string")) throw Error();
      const score = formatScore(data);
      if (!abort.signal.aborted) setText("Оценка за белых " + score + (data.line.length ? " · " + data.line.join(" ") : ""));
    }).catch(() => { if (!abort.signal.aborted) setText("Движок недоступен. Попробуйте ещё раз."); });
    return () => abort.abort();
  }, [id, ply, engine]);
  return <p role="status">{text}</p>;
}

export function EngineAnalysis({ id, ply, initial }: { id: string; ply: number; initial: Engine }) {
  const [engine, setEngine] = useState(initial);
  const [active, setActive] = useState(false);
  return <fieldset><legend>Анализ позиции</legend>
    <label>Движок анализа <select value={engine} onChange={e => setEngine(e.target.value === "lc0" ? "lc0" : "stockfish")}>
      <option value="lc0">Leela Chess Zero</option><option value="stockfish">Stockfish</option>
    </select></label>
    <button onClick={() => setActive(!active)}>{active ? "Остановить анализ" : "Оценить позицию"}</button>
    {active && <Evaluation key={id + ply + engine} id={id} ply={ply} engine={engine} />}
  </fieldset>;
}
