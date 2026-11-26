import React, { useEffect, useState } from "react";
import type { Game } from "../../features/play";
import { useLanguage } from "../../shared/language";
import styles from "./game.module.css";

export function MoveTimes({ game, ply, select }: { game: Game; ply: number; select: (ply: number) => void }) {
  const { language, t } = useLanguage();
  const [values, setValues] = useState<(number | null)[]>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [inspect, setInspect] = useState<number>();
  const timed = !!game.clock;
  useEffect(() => {
    if (!timed || !game.moves.length) return;
    const abort = new AbortController();
    async function load() {
      const response = await fetch("/api/games/" + game.id + "/move-times", { signal: abort.signal });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!Array.isArray(data) || data.length !== game.moves.length ||
          !data.every(value => value === null || Number.isSafeInteger(value) && value >= 0)) throw Error();
      if (!abort.signal.aborted) setValues(data);
    }
    setError(false);
    load().catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [game.id, game.moves.length, timed, retry]);
  if (!timed) return <p>{t("Партия без часов", "Game without clocks", "Partida sin reloj")}</p>;
  if (!game.moves.length) return <p>{t("Ходов пока нет", "No moves recorded", "Sin jugadas")}</p>;
  if (error) return <p role="alert">{t("Не удалось загрузить время ходов.", "Could not load move times.", "No se pudieron cargar los tiempos.")} <button onClick={() => setRetry(retry + 1)}>{t("Повторить", "Retry", "Reintentar")}</button></p>;
  if (!values) return <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p>;
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 3 });
  const seconds = (ms: number) => number.format(ms / 1000) + " " + t("с", "s", "s");
  const missing = t("Нет данных", "No data", "Sin datos");
  const peak = values.reduce<number>((max, value) => Math.max(max, value ?? 0), 0);
  function label(i: number) {
    const side = i % 2 ? t("Чёрные", "Black", "Negras") : t("Белые", "White", "Blancas");
    const value = values![i];
    return Math.floor(i / 2 + 1) + (i % 2 ? "… " : ". ") + game.moves[i] + " · " + side + " · " + (value === null ? missing : seconds(value));
  }
  const detail = inspect ?? (ply ? ply - 1 : undefined);
  return <figure className={styles.timeChart}>
    <figcaption>{t("Время на ход", "Time per move", "Tiempo por jugada")} · {t("Белые / Чёрные", "White / Black", "Blancas / Negras")}</figcaption>
    <div className={styles.chartBody}><div className={styles.axis}><span>{seconds(peak)}</span><span>0</span></div>
      <div className={styles.chartScroll}><div className={styles.columns}>{values.map((value, i) =>
        <div key={i}><button type="button" aria-label={label(i)} title={label(i)} aria-pressed={ply === i + 1}
          onFocus={() => setInspect(i)} onBlur={() => setInspect(undefined)} onMouseEnter={() => setInspect(i)} onMouseLeave={() => setInspect(undefined)}
          onClick={() => select(i + 1)}>
          {value === null ? "—" : <span style={{ height: Math.max(1, 100 * value / (peak || 1)) + "%" }} />}
        </button><small>{i % 2 === 0 ? Math.floor(i / 2 + 1) : " "}</small></div>)}</div></div>
    </div>
    <output>{detail !== undefined ? label(detail) : t("Начальная позиция", "Starting position", "Posición inicial")}</output>
  </figure>;
}
