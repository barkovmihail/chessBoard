import React, { useEffect, useState } from "react";

const labels = { turn: "Ваш ход", finish: "Партия завершена", challenge: "Новый вызов", accepted: "Вызов принят", declined: "Вызов отклонён", canceled: "Вызов отменён" };
interface Notice {
  result: string | null; id: number; kind: keyof typeof labels; opponent: string; created: number; seen: boolean; game_id: string | null;
}
interface Feed { items: Notice[]; unread: number; before: number | null }

export function Notifications({ onInbox }: { onInbox: () => void }) {
  const [open, setOpen] = useState(false);
  const [before, setBefore] = useState<number>();
  const [feed, setFeed] = useState<Feed>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/notifications" + (before ? "?before=" + before : ""), { signal: abort.signal, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !Number.isInteger(data.unread) || !(data.before === null || Number.isInteger(data.before)) ||
            !Array.isArray(data.items) || !data.items.every((n: Notice) => n && Object.prototype.hasOwnProperty.call(labels, n.kind) &&
            Number.isInteger(n.id) && Number.isInteger(n.created) && typeof n.opponent === "string" &&
            (n.result === null || typeof n.result === "string") && typeof n.seen === "boolean" && (n.game_id === null || typeof n.game_id === "string"))) throw Error();
        if (!abort.signal.aborted) { setFeed(data); setError(""); }
      } catch { if (!abort.signal.aborted) setError("Не удалось загрузить уведомления."); }
      if (!abort.signal.aborted) timer = setTimeout(load, open ? 4000 : 12000);
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [open, before, refresh]);
  async function read(id?: number) {
    try {
      const res = await fetch("/api/notifications/read" + (id ? "?item=" + id : ""), { method: "POST" });
      if (!res.ok) throw Error();
      setRefresh(n => n + 1);
    } catch { setError("Не удалось отметить прочитанным."); }
  }
  return <details open={open} className="current-games" onToggle={e => {
    setOpen(e.currentTarget.open);
    if (!e.currentTarget.open) setBefore(undefined);
  }}>
    <summary>🔔 Уведомления {feed?.unread || ""}</summary>
    <section aria-label="Лента уведомлений">
      {error && <p role="alert">{error}</p>}
      {feed?.unread ? <button onClick={() => read()}>Прочитать все</button> : null}
      {feed && !feed.items.length && <p>Уведомлений пока нет</p>}
      <ul>{feed?.items.map(n => <li key={n.id}>
        <p>{labels[n.kind]}{n.result && " · " + n.result} · {n.opponent} · {new Date(n.created).toLocaleString("ru-RU")}</p>
        {n.game_id ? <a href={"?game=" + encodeURIComponent(n.game_id)}>Открыть партию</a> :
          <button onClick={() => { setOpen(false); onInbox(); }}>К вызовам</button>}
        {!n.seen && <button onClick={() => read(n.id)}>Отметить прочитанным</button>}
      </li>)}</ul>
      {before && <button onClick={() => setBefore(undefined)}>К новым</button>}
      {feed?.before && <button onClick={() => setBefore(feed.before!)}>Более ранние</button>}
    </section>
  </details>;
}
