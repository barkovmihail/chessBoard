import React, { useEffect, useState } from "react";
import { useLanguage } from "../../shared/language";
import { usePuzzleThemes } from "../../shared/puzzle-themes";

interface ThemeStats { solved: number; mistakes: number }
interface Progress { practiced: number; solved: number; first: number; themes: Record<string, ThemeStats> }

export function PuzzleProgress() {
  const { t, language } = useLanguage();
  const themes = usePuzzleThemes();
  const [days, setDays] = useState("30");
  const [data, setData] = useState<Progress>();
  const [failed, setFailed] = useState(false);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setFailed(false);
    setData(undefined);
    async function load() {
      const res = await fetch("/api/profile/puzzle-progress?days=" + days, { signal: abort.signal, cache: "no-store" });
      if (!res.ok) throw Error();
      const stats: Progress = await res.json();
      if (![stats.practiced, stats.solved, stats.first].every(Number.isSafeInteger) || !stats.themes ||
          !Object.values(stats.themes).every(row => row && Number.isSafeInteger(row.solved) && Number.isSafeInteger(row.mistakes))) throw Error();
      if (!abort.signal.aborted) setData(stats);
    }
    load().catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [days, revision]);
  const title = t("Прогресс в задачах", "Puzzle progress", "Progreso en problemas");
  return <section aria-label={title}><h2>{title}</h2>
    <label>{t("Последние дни", "Days to include", "Últimos días")} <select value={days} onChange={e => setDays(e.target.value)}>
      {[7, 30, 90].map(n => <option key={n}>{n}</option>)}</select></label>
    {failed ? <p role="alert">{t("Не удалось загрузить статистику.", "Could not load statistics.", "No se pudieron cargar las estadísticas.")} <button onClick={() => refresh(n => n + 1)}>{t("Повторить", "Retry", "Reintentar")}</button></p>
      : !data ? <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p>
      : !data.practiced ? <p>{t("За этот период попыток нет.", "No attempts in this period.", "No hay intentos en este periodo.")} <a href="?section=puzzles">{t("Решать задачи", "Solve puzzles", "Resolver problemas")}</a></p>
      : <><p>{t("Решено задач", "Puzzles solved", "Problemas resueltos")} · {data.solved}/{data.practiced}</p>
        <p>{t("С первой попытки без ошибок", "Solved on the first try without mistakes", "Resueltos al primer intento sin errores")} · {new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 }).format(data.first / data.practiced)}</p>
        {Object.keys(data.themes).length > 0 && <table><thead><tr>
          <th>{t("Тема", "Theme", "Tema")}</th><th>{t("Решено", "Solved", "Resueltos")}</th><th>{t("Ошибки", "Mistakes", "Errores")}</th>
        </tr></thead><tbody>{Object.entries(data.themes).sort(([a, x], [b, y]) => y.mistakes - x.mistakes || a.localeCompare(b)).map(([key, row]) =>
          <tr key={key}><th scope="row"><a href={"?section=puzzles&theme=" + encodeURIComponent(key)}>{themes[key]}</a></th><td>{row.solved}</td><td>{row.mistakes}</td></tr>)}</tbody></table>}
      </>}
  </section>;
}
