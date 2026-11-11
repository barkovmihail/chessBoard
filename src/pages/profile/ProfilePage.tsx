import React, { useEffect, useState } from "react";
import { Account } from "./Account";
import { reasons } from "../../features/play";

interface Entry {
  id: string;
  opponent: string | null;
  side: "white" | "black" | "both";
  result: string;
  reason: string;
  base_minutes: number | null;
  increment_seconds: number | null;
  finished_ms: number | null;
}

function validEntry(row: Entry) {
  return row && typeof row.id === "string" && (row.opponent === null || typeof row.opponent === "string") && ["white", "black", "both"].includes(row.side) &&
    typeof row.result === "string" && typeof row.reason === "string" &&
    [row.finished_ms, row.base_minutes, row.increment_seconds].every(n => n === null || Number.isSafeInteger(n));
}

export function ProfilePage() {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{items: Entry[]; next_offset: number | null}>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setPage(undefined);
    setError(false);
    fetch("/api/profile/games?offset=" + offset, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!Array.isArray(data.items) || !data.items.every(validEntry) ||
          !(data.next_offset === null || Number.isSafeInteger(data.next_offset))) throw Error();
      if (!abort.signal.aborted) setPage(data);
    }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [offset, retry]);
  return <main><h1>Профиль</h1><Account /><h2>История игр</h2>
    {error ? <p role="alert">Не удалось загрузить партии. <button onClick={() => setRetry(retry + 1)}>Повторить</button></p> :
      !page ? <p>Загрузка…</p> : <>
        {!page.items.length && <p>Завершённых партий пока нет</p>}
        <ul>{page.items.map(game => <li key={game.id}><a href={"?game=" + encodeURIComponent(game.id)}>
          {game.finished_ms === null ? "Дата неизвестна" : new Date(game.finished_ms).toLocaleString("ru-RU")} · {
          game.side === "both" ? "На одном устройстве" : (game.opponent ?? "Гость") + " · " + (game.side === "white" ? "Вы играли белыми" : "Вы играли чёрными")} · {
          game.base_minutes === null ? "Без часов" : game.base_minutes + "+" + game.increment_seconds} · {
          game.result} · {reasons[game.reason] ?? game.reason}</a></li>)}</ul>
        {offset > 0 && <button onClick={() => setOffset(Math.max(0, offset - 20))}>Предыдущая страница</button>}
        {page.next_offset !== null && <button onClick={() => setOffset(page.next_offset!)}>Следующая страница</button>}
      </>}
  </main>;
}
