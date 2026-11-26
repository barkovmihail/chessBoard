import { ToolbarPanel, type PanelView } from "./ToolbarPanel";
import { useLanguage } from "../shared/language";
import React, { useEffect, useState } from "react";

import { Challenges } from "./Challenges";

interface Entry {
  id: string;
  opponent: string | null;
  base_minutes: number | null;
  increment_seconds: number | null;
  side: "white" | "black" | "both";
  turn: "white" | "black";
  waiting: boolean;
}

function isEntry(row: Entry) {
  return row && typeof row.id === "string" && (row.opponent === null || typeof row.opponent === "string") &&
    ["white", "black", "both"].includes(row.side) && ["white", "black"].includes(row.turn) &&
    typeof row.waiting === "boolean" && [row.base_minutes, row.increment_seconds].every(n => n === null || Number.isInteger(n));
}

function describe(row: Entry, t: (ru: string, en: string, es: string) => string) {
  const color = row.side === "white" ? t("Белые", "White", "Blancas") : t("Чёрные", "Black", "Negras");
  const title = row.side === "both" ? t("На одном устройстве", "On one device", "En un solo dispositivo") : row.waiting ? color : (row.opponent ?? t("Гость", "Guest", "Invitado")) + " · " + color;
  const status = row.waiting ? t("Ожидание соперника", "Waiting for opponent", "Esperando rival") : row.side === "both" ?
    (row.turn === "white" ? t("Ход белых", "White to move", "Juegan las blancas") : t("Ход чёрных", "Black to move", "Juegan las negras")) : row.turn === row.side ? t("Ваш ход", "Your turn", "Tu turno") : t("Ход соперника", "Opponent’s turn", "Turno del rival");
  const clock = row.base_minutes === null ? t("Без часов", "Unlimited", "Sin reloj") : row.base_minutes + "+" + row.increment_seconds;
  return [title, clock, status].join(" · ");
}

export function CurrentGames(view: PanelView) {
  const { open } = view;
  const { t } = useLanguage();
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{items: Entry[]; next_offset: number | null}>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) { setOffset(0); return; }
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setPage(undefined);
    setError(false);
    async function load() {
      try {
        const response = await fetch("/api/profile/games?active=true&offset=" + offset, { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!Array.isArray(data.items) || !data.items.every(isEntry) ||
            !(data.next_offset === null || Number.isInteger(data.next_offset))) throw Error();
        if (abort.signal.aborted) return;
        setPage(data);
        setError(false);
      } catch { if (!abort.signal.aborted) setError(true); }
      if (!abort.signal.aborted) timer = setTimeout(load, 4000);
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [open, offset]);
  const challenges = <Challenges open={open} count={setCount} />;
  const games = <div role="region" aria-label={t("Текущие партии", "Active games", "Partidas en curso")}><h3>{t("Текущие игры", "Current games", "Partidas en curso")}</h3>
      {error ? <p role="alert">{t("Не удалось обновить список. Повторяем запрос…", "Could not update the list. Retrying…", "No se pudo actualizar la lista. Reintentando…")}</p> : !page && <p>{t("Загрузка…", "Loading…", "Cargando…")}</p>}
      {page && <>
        {!page.items.length && <p>{t("Текущих игр нет", "No current games", "No hay partidas en curso")}</p>}
        <ul>{page.items.map(row => <li key={row.id}><a href={"?game=" + encodeURIComponent(row.id)}>{describe(row, t)}</a></li>)}</ul>
        {offset > 0 && <button onClick={() => setOffset(offset - 20)}>{t("Назад", "Previous", "Anterior")}</button>}
        {page.next_offset !== null && <button onClick={() => setOffset(page.next_offset!)}>{t("Далее", "Next", "Siguiente")}</button>}
      </>}
    </div>;
  const title = t("Вызовы и текущие игры", "Challenges and current games", "Desafíos y partidas en curso");
  if (view.fullPage) return <main className="atlas-page"><h1 className="atlas-heading">{title}</h1><div className="atlas-columns">
    <section className="atlas-card inbox-games">{games}</section><aside className="atlas-card inbox-challenges">{challenges}</aside>
  </div></main>;
  return <ToolbarPanel open={open} onToggle={view.onToggle} onClose={view.onClose} title={title} icon="swords" count={count}>
    {challenges}{games}<a className="panel-link" href="?section=inbox">{t("Все вызовы и игры", "All challenges and games", "Todos los desafíos y partidas")} →</a>
  </ToolbarPanel>;
}
