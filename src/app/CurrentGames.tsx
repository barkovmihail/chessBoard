import { NavIcon } from "./NavIcon";
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

export function CurrentGames({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { t } = useLanguage();
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{items: Entry[]; next_offset: number | null}>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
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
  return <details open={open} className="current-games" onToggle={event => {
    setOpen(event.currentTarget.open);
    if (!event.currentTarget.open) setOffset(0);
  }}>
    <summary className="nav-trigger" title={t("Вызовы и текущие игры", "Challenges and current games", "Desafíos y partidas en curso")} aria-label={t("Вызовы и текущие игры", "Challenges and current games", "Desafíos y partidas en curso") + (count ? " · " + count : "")}><NavIcon name="swords" />{count > 0 && <small>{count}</small>}</summary>
    <section><Challenges open={open} count={setCount} />
    <div role="region" aria-label={t("Текущие партии", "Active games", "Partidas en curso")}><h3>{t("Текущие игры", "Current games", "Partidas en curso")}</h3>
      {error ? <p role="alert">{t("Не удалось обновить список. Повторяем запрос…", "Could not update the list. Retrying…", "No se pudo actualizar la lista. Reintentando…")}</p> : !page && <p>{t("Загрузка…", "Loading…", "Cargando…")}</p>}
      {page && <>
        {!page.items.length && <p>{t("Текущих игр нет", "No current games", "No hay partidas en curso")}</p>}
        <ul>{page.items.map(row => <li key={row.id}><a href={"?game=" + encodeURIComponent(row.id)}>{describe(row, t)}</a></li>)}</ul>
        {offset > 0 && <button onClick={() => setOffset(offset - 20)}>{t("Назад", "Previous", "Anterior")}</button>}
        {page.next_offset !== null && <button onClick={() => setOffset(page.next_offset!)}>{t("Далее", "Next", "Siguiente")}</button>}
      </>}
    </div></section>
  </details>;
}
