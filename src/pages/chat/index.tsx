import React, { useEffect, useRef, useState } from "react";
import { commandId } from "../../shared/commandId";

interface Message { seq: number; name: string; body: string; reported: boolean }
interface Complaint { seq: number; name: string; body: string; count: number }
interface Feed { name: string | null; muted: boolean; moderator: boolean; blocked: string[]; messages: Message[]; queue: Complaint[] }

function validRow(row: Message | Complaint) {
  return row && Number.isSafeInteger(row.seq) && typeof row.name === "string" && typeof row.body === "string";
}

export function ChatPage() {
  const [feed, setFeed] = useState<Feed>();
  const [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
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
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/chat/" + path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}) });
      if (!response.ok) throw Error();
      refresh(n => n + 1);
      return true;
    } catch { setError("Изменение не подтверждено. Повторите попытку."); return false; }
    finally { setBusy(false); }
  }

  return <main className="study-page"><h1>Общий чат</h1>
    {loadError && <p role="alert">Не удалось загрузить чат. <button onClick={() => refresh(n => n + 1)}>Повторить</button></p>}
    {error && <p role="alert">{error}</p>}
    {feed && <>
      {feed.name && <button disabled={busy} onClick={() => act("preferences/" + (feed.muted ? "unmute" : "mute"))}>
        {feed.muted ? "Включить сообщения" : "Отключить сообщения"}</button>}
      {!feed.muted && <>
        <ol aria-label="Сообщения чата">{feed.messages.map(m => <li key={m.seq}><strong>{m.name}</strong> {m.body}
          {feed.name && feed.name !== m.name && <div>
            <button disabled={busy} onClick={() => act("authors/block", { name: m.name })}>Скрыть автора</button>
            <button disabled={busy || m.reported} onClick={() => act("messages/" + m.seq + "/report")}>{m.reported ? "Жалоба отправлена" : "Пожаловаться"}</button>
          </div>}</li>)}</ol>
        {feed.name ? <form onSubmit={async e => {
          e.preventDefault();
          if (!draftKey.current) draftKey.current = commandId();
          if (await act("messages", { body, token: draftKey.current })) { setBody(""); draftKey.current = ""; }
        }}><label>Сообщение <input disabled={busy} maxLength={500} value={body} onChange={e => { draftKey.current = ""; setBody(e.target.value); }} /></label>
          <button disabled={busy || !body.trim()}>Отправить сообщение</button></form> : <a href="?section=profile">Войти, чтобы написать</a>}
      </>}
      {feed.blocked.map(name => <button key={name} disabled={busy} onClick={() => act("authors/unblock", { name })}>Показывать сообщения от {name}</button>)}
      {feed.moderator && <section><h2>Жалобы на сообщения</h2>
        {!feed.queue.length && <p>Нет открытых жалоб.</p>}
        {feed.queue.map(m => <article key={m.seq}><p>{m.name} · {m.body}</p><p>Жалоб: {m.count}</p>
          <button disabled={busy} onClick={() => act("reports/" + m.seq + "/hide")}>Скрыть сообщение для всех</button>
          <button disabled={busy} onClick={() => act("reports/" + m.seq + "/dismiss")}>Отклонить жалобу</button></article>)}
      </section>}
    </>}</main>;
}
