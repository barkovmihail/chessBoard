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

function describe(row: Entry) {
  const color = row.side === "white" ? "Белые" : "Чёрные";
  const title = row.side === "both" ? "На одном устройстве" : row.waiting ? color : (row.opponent ?? "Гость") + " · " + color;
  const status = row.waiting ? "Ожидание соперника" : row.side === "both" ?
    (row.turn === "white" ? "Ход белых" : "Ход чёрных") : row.turn === row.side ? "Ваш ход" : "Ход соперника";
  const clock = row.base_minutes === null ? "Без часов" : row.base_minutes + "+" + row.increment_seconds;
  return [title, clock, status].join(" · ");
}

export function CurrentGames({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
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
    <summary aria-label={"Вызовы и текущие игры" + (count ? " · " + count : "")}>⚔ Вызовы и игры {count || ""}</summary>
    <section><Challenges open={open} count={setCount} />
    <div role="region" aria-label="Текущие партии"><h3>Текущие игры</h3>
      {error ? <p role="alert">Не удалось обновить список. Повторяем запрос…</p> : !page && <p>Загрузка…</p>}
      {page && <>
        {!page.items.length && <p>Текущих игр нет</p>}
        <ul>{page.items.map(row => <li key={row.id}><a href={"?game=" + encodeURIComponent(row.id)}>{describe(row)}</a></li>)}</ul>
        {offset > 0 && <button onClick={() => setOffset(offset - 20)}>Назад</button>}
        {page.next_offset !== null && <button onClick={() => setOffset(page.next_offset!)}>Далее</button>}
      </>}
    </div></section>
  </details>;
}
