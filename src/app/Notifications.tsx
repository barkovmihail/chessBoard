import { ToolbarPanel, type PanelView } from "./ToolbarPanel";
import { useLanguage } from "../shared/language";
import React, { useEffect, useRef, useState } from "react";

import { playSound } from "../shared/sound";

const spanish = { turn: "Tu turno", finish: "Partida terminada", challenge: "Nuevo desafío", accepted: "Desafío aceptado", declined: "Desafío rechazado", canceled: "Desafío cancelado" };
const english = { turn: "Your turn", finish: "Game finished", challenge: "New challenge", accepted: "Challenge accepted", declined: "Challenge declined", canceled: "Challenge canceled" };
const labels = { turn: "Ваш ход", finish: "Партия завершена", challenge: "Новый вызов", accepted: "Вызов принят", declined: "Вызов отклонён", canceled: "Вызов отменён" };
interface Notice {
  result: string | null; id: number; kind: keyof typeof labels; opponent: string; created: number; seen: boolean; game_id: string | null;
}
interface Feed { items: Notice[]; unread: number; before: number | null }

export function Notifications(view: PanelView & { onInbox: () => void }) {
  const { open, onInbox } = view;
  const { language, t } = useLanguage();
  const latest = useRef<number>();
  const [before, setBefore] = useState<number>();
  const [feed, setFeed] = useState<Feed>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<"load" | "read" | null>(null);
  useEffect(() => { if (!open) setBefore(undefined); }, [open]);
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
  const title = t("Уведомления", "Notifications", "Notificaciones");
  const feedTitle = t("Лента уведомлений", "Notification feed", "Lista de notificaciones");
  const content = <>
      {!feed && !error && <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p>}
      {error && <p role="alert">{error === "load" ? t("Не удалось загрузить уведомления.", "Could not load notifications.", "No se pudieron cargar las notificaciones.") : t("Не удалось отметить прочитанным.", "Could not mark as read.", "No se pudo marcar como leído.")}</p>}
      {feed?.unread ? <button onClick={() => read()}>{t("Прочитать все", "Mark all as read", "Marcar todas como leídas")}</button> : null}
      {feed && !feed.items.length && <p>{t("Уведомлений пока нет", "No notifications yet", "Todavía no hay notificaciones")}</p>}
      <ul>{feed?.items.map(n => <li key={n.id}>
        <p>{t(labels[n.kind], english[n.kind], spanish[n.kind])}{n.result && " · " + n.result} · {n.opponent === "Гость" ? t("Гость", "Guest", "Invitado") : n.opponent === "На одном устройстве" ? t("На одном устройстве", "On one device", "En un solo dispositivo") : n.opponent} · {new Date(n.created).toLocaleString(language)}</p>
        {n.game_id ? <a href={"?game=" + encodeURIComponent(n.game_id)}>{t("Открыть партию", "Open game", "Abrir partida")}</a> :
          <button onClick={onInbox}>{t("К вызовам", "View challenges", "Ver desafíos")}</button>}
        {!n.seen && <button onClick={() => read(n.id)}>{t("Отметить прочитанным", "Mark as read", "Marcar como leída")}</button>}
      </li>)}</ul>
      {before && <button onClick={() => setBefore(undefined)}>{t("К новым", "Newest", "Más recientes")}</button>}
      {feed?.before && <button onClick={() => { latest.current = undefined; setBefore(feed.before!); }}>{t("Более ранние", "Older", "Anteriores")}</button>}
    </>;
  if (view.fullPage) return <main className="atlas-page"><h1 className="atlas-heading">{title}</h1><div className="atlas-columns">
    <section className="atlas-card notification-feed"><h2>{feedTitle}</h2>{content}</section>
    <aside className="atlas-card"><h2>{t("Настройки событий", "Event settings", "Ajustes de eventos")}</h2>
      <p className="atlas-muted">{t("Выберите события, о которых хотите получать уведомления.", "Choose which events you want to hear about.", "Elige los eventos sobre los que quieres recibir notificaciones.")}</p>
      <a href="?section=profile&settings=1#notification-settings">{t("Настроить уведомления", "Manage notifications", "Configurar notificaciones")} →</a>
    </aside>
  </div></main>;
  return <ToolbarPanel open={open} onToggle={view.onToggle} onClose={view.onClose} title={title}
    regionLabel={feedTitle} icon="bell" count={feed?.unread}>
    {content}<a className="panel-link" href="?section=feed">{t("Все уведомления", "All notifications", "Todas las notificaciones")} →</a>
  </ToolbarPanel>;
}
