import { NavIcon } from "./NavIcon";
import { useLanguage } from "../shared/language";
import React, { useEffect, useRef, useState } from "react";

import { playSound } from "../shared/sound";

const english = { turn: "Your turn", finish: "Game finished", challenge: "New challenge", accepted: "Challenge accepted", declined: "Challenge declined", canceled: "Challenge canceled" };
const labels = { turn: "Ваш ход", finish: "Партия завершена", challenge: "Новый вызов", accepted: "Вызов принят", declined: "Вызов отклонён", canceled: "Вызов отменён" };
interface Notice {
  result: string | null; id: number; kind: keyof typeof labels; opponent: string; created: number; seen: boolean; game_id: string | null;
}
interface Feed { items: Notice[]; unread: number; before: number | null }

export function Notifications({ onInbox }: { onInbox: () => void }) {
  const { language, t } = useLanguage();
  const latest = useRef<number>();
  const [open, setOpen] = useState(false);
  const [before, setBefore] = useState<number>();
  const [feed, setFeed] = useState<Feed>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<"load" | "read" | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/notifications" + (before ? "?before=" + before : ""), { signal: abort.signal, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || typeof data.sound !== "boolean" || !Number.isInteger(data.unread) || !(data.before === null || Number.isInteger(data.before)) ||
            !Array.isArray(data.items) || !data.items.every((n: Notice) => n && Object.prototype.hasOwnProperty.call(labels, n.kind) &&
            Number.isInteger(n.id) && Number.isInteger(n.created) && typeof n.opponent === "string" &&
            (n.result === null || typeof n.result === "string") && typeof n.seen === "boolean" && (n.game_id === null || typeof n.game_id === "string"))) throw Error();
        if (abort.signal.aborted) return;
        if (!before) {
          const params = new URLSearchParams(location.search);
          const currentGame = params.has("section") ? null : params.get("game");
          const previous = latest.current;
          if (data.sound && previous !== undefined && data.items.some((notice: Notice) =>
            notice.id > previous && !notice.seen && !(currentGame && notice.game_id === currentGame &&
              (notice.kind === "turn" || notice.kind === "finish")))) playSound("notice");
          latest.current = data.items[0]?.id ?? 0;
        }
        setFeed(data);
        setError(null);
      } catch {
        if (!abort.signal.aborted) {
          latest.current = undefined;
          setError("load");
        }
      }
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
    } catch { setError("read"); }
  }
  return <details open={open} className="current-games" onToggle={e => {
    setOpen(e.currentTarget.open);
    if (!e.currentTarget.open) setBefore(undefined);
  }}>
    <summary className="nav-trigger" title={t("Уведомления", "Notifications")} aria-label={[t("Уведомления", "Notifications"), feed?.unread || ""].join(" ").trim()}><NavIcon name="bell" />{!!feed?.unread && <small>{feed.unread}</small>}</summary>
    <section aria-label={t("Лента уведомлений", "Notification feed")}>
      {error && <p role="alert">{error === "load" ? t("Не удалось загрузить уведомления.", "Could not load notifications.") : t("Не удалось отметить прочитанным.", "Could not mark as read.")}</p>}
      {feed?.unread ? <button onClick={() => read()}>{t("Прочитать все", "Mark all as read")}</button> : null}
      {feed && !feed.items.length && <p>{t("Уведомлений пока нет", "No notifications yet")}</p>}
      <ul>{feed?.items.map(n => <li key={n.id}>
        <p>{t(labels[n.kind], english[n.kind])}{n.result && " · " + n.result} · {n.opponent === "Гость" ? t("Гость", "Guest") : n.opponent === "На одном устройстве" ? t("На одном устройстве", "On one device") : n.opponent} · {new Date(n.created).toLocaleString(language)}</p>
        {n.game_id ? <a href={"?game=" + encodeURIComponent(n.game_id)}>{t("Открыть партию", "Open game")}</a> :
          <button onClick={() => { setOpen(false); onInbox(); }}>{t("К вызовам", "View challenges")}</button>}
        {!n.seen && <button onClick={() => read(n.id)}>{t("Отметить прочитанным", "Mark as read")}</button>}
      </li>)}</ul>
      {before && <button onClick={() => setBefore(undefined)}>{t("К новым", "Newest")}</button>}
      {feed?.before && <button onClick={() => { latest.current = undefined; setBefore(feed.before!); }}>{t("Более ранние", "Older")}</button>}
    </section>
  </details>;
}
