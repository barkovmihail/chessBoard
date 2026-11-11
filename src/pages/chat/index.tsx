import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { commandId } from "../../shared/commandId";

interface Message { seq: number; name: string; body: string; reported: boolean }
interface Complaint { seq: number; name: string; body: string; count: number }
interface Feed { name: string | null; muted: boolean; moderator: boolean; blocked: string[]; messages: Message[]; queue: Complaint[] }

function validRow(row: Message | Complaint) {
  return row && Number.isSafeInteger(row.seq) && typeof row.name === "string" && typeof row.body === "string";
}

export function ChatPage() {
  const { language, t } = useLanguage();
  const [feed, setFeed] = useState<Feed>();
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState(false);
  const [body, setBody] = useState("");
  const draftKey = useRef("");
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch("/api/chat", { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!data || !(data.name === null || typeof data.name === "string") || typeof data.muted !== "boolean" ||
          typeof data.moderator !== "boolean" || !Array.isArray(data.blocked) || !data.blocked.every((s: unknown) => typeof s === "string") ||
          !Array.isArray(data.messages) || !data.messages.every((r: Message) => validRow(r) && typeof r.reported === "boolean") ||
          !Array.isArray(data.queue) || !data.queue.every((r: Complaint) => validRow(r) && Number.isSafeInteger(r.count))) throw Error();
        if (!abort.signal.aborted) { setFeed(data); setLoadError(false); }
      } catch { if (!abort.signal.aborted) setLoadError(true); }
      if (!abort.signal.aborted) timer = setTimeout(load, 2500);
    }
    void load();
    return () => { clearTimeout(timer); abort.abort(); };
  }, [revision]);

  async function act(path: string, data?: object) {
    setBusy(true); setError(false);
    try {
      const response = await fetch("/api/chat/" + path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}) });
      if (!response.ok) throw Error();
      refresh(n => n + 1);
      return true;
    } catch { setError(true); return false; }
    finally { setBusy(false); }
  }

  return <main lang={language} className="study-page"><h1>{t("Общий чат", "Public chat", "Chat público")}</h1>
    {loadError && <p role="alert">{t("Не удалось загрузить чат.", "Could not load chat.", "No se pudo cargar el chat.")} <button onClick={() => refresh(n => n + 1)}>{t("Повторить", "Retry", "Reintentar")}</button></p>}
    {error && <p role="alert">{t("Изменение не подтверждено. Повторите попытку.", "Change not confirmed. Try again.", "No se pudo confirmar el cambio. Vuelve a intentarlo.")}</p>}
    {feed && <>
      {feed.name && <button disabled={busy} onClick={() => act("preferences/" + (feed.muted ? "unmute" : "mute"))}>
        {feed.muted ? t("Включить сообщения", "Enable messages", "Activar mensajes") : t("Отключить сообщения", "Mute messages", "Silenciar mensajes")}</button>}
      {!feed.muted && <>
        <ol aria-label={t("Сообщения чата", "Chat messages", "Mensajes del chat")}>{feed.messages.map(m => <li key={m.seq}><strong>{m.name}</strong> {m.body}
          {feed.name && feed.name !== m.name && <div>
            <button disabled={busy} onClick={() => act("authors/block", { name: m.name })}>{t("Скрыть автора", "Hide author", "Ocultar autor")}</button>
            <button disabled={busy || m.reported} onClick={() => act("messages/" + m.seq + "/report")}>{m.reported ? t("Жалоба отправлена", "Reported", "Denuncia enviada") : t("Пожаловаться", "Report", "Denunciar")}</button>
          </div>}</li>)}</ol>
        {feed.name ? <form onSubmit={async e => {
          e.preventDefault();
          if (!draftKey.current) draftKey.current = commandId();
          if (await act("messages", { body, token: draftKey.current })) { setBody(""); draftKey.current = ""; }
        }}><label>{t("Сообщение", "Message", "Mensaje")} <input disabled={busy} maxLength={500} value={body} onChange={e => { draftKey.current = ""; setBody(e.target.value); }} /></label>
          <button disabled={busy || !body.trim()}>{t("Отправить сообщение", "Send message", "Enviar mensaje")}</button></form> : <a href="?section=profile">{t("Войти, чтобы написать", "Sign in to post", "Inicia sesión para escribir")}</a>}
      </>}
      {feed.blocked.map(name => <button key={name} disabled={busy} onClick={() => act("authors/unblock", { name })}>{t("Показывать сообщения от", "Show messages from", "Mostrar mensajes de")} {name}</button>)}
      {feed.moderator && <section><h2>{t("Жалобы на сообщения", "Message reports", "Denuncias de mensajes")}</h2>
        {!feed.queue.length && <p>{t("Нет открытых жалоб.", "No open reports.", "No hay denuncias pendientes.")}</p>}
        {feed.queue.map(m => <article key={m.seq}><p>{m.name} · {m.body}</p><p>{t("Жалоб:", "Reports:", "Denuncias:")} {m.count}</p>
          <button disabled={busy} onClick={() => act("reports/" + m.seq + "/hide")}>{t("Скрыть сообщение для всех", "Hide message for everyone", "Ocultar mensaje para todos")}</button>
          <button disabled={busy} onClick={() => act("reports/" + m.seq + "/dismiss")}>{t("Отклонить жалобу", "Dismiss report", "Desestimar denuncia")}</button></article>)}
      </section>}
    </>}</main>;
}
