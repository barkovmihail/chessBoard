import React, { useEffect, useRef, useState } from "react";
import { commandId } from "../../shared/commandId";
import { useLanguage } from "../../shared/language";

import styles from "./messages.module.css";

interface Message {
  seq: number; sender: string; recipient: string; body: string; outgoing: boolean; created: number;
}
interface Page { items: Message[]; before: number | null }

export function MessagesPage() {
  const { language, t } = useLanguage();
  const [page, setPage] = useState<Page>();
  const [before, setBefore] = useState<number>();
  const [refresh, update] = useState(0);
  const [guest, setGuest] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<"recipient" | "send" | null>(null);
  const token = useRef("");
  const editor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch("/api/private-messages" + (before ? "?before=" + before : ""),
          { cache: "no-store", signal: abort.signal });
        if (abort.signal.aborted) return;
        if (response.status === 403) { setPage(undefined); setGuest(true); return; }
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!Array.isArray(data.items) || !(data.before === null || Number.isSafeInteger(data.before)) ||
          !data.items.every((m: Message) => m && Number.isSafeInteger(m.seq) && Number.isSafeInteger(m.created) &&
            typeof m.sender === "string" && typeof m.recipient === "string" &&
            typeof m.body === "string" && typeof m.outgoing === "boolean")) throw Error();
        if (!abort.signal.aborted) { setPage(data); setLoadFailed(false); }
      } catch { if (!abort.signal.aborted) setLoadFailed(true); }
      if (!abort.signal.aborted) timer = setTimeout(load, 3000);
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [before, refresh]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    token.current ||= commandId();
    setBusy(true); setSendError(null);
    try {
      const response = await fetch("/api/private-messages", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient, body, token: token.current }) });
      if (response.status === 403) { setPage(undefined); setGuest(true); return; }
      if (!response.ok) {
        const { detail } = await response.json();
        setSendError(detail === "invalid_recipient" ? "recipient" : "send");
        return;
      }
      token.current = "";
      setBody(""); setBefore(undefined); update(n => n + 1);
    } catch { setSendError("send"); }
    finally { setBusy(false); }
  }
  return <main className={"study-page " + styles.messages}><h1>{t("Личные сообщения", "Private messages")}</h1>
    {guest ? <a href="?section=profile#account">{t("Войти", "Sign in")}</a> : <>
      {page && <form onSubmit={send}><fieldset disabled={busy}>
        <label>{t("Кому", "Recipient")} <input required maxLength={32} value={recipient}
          onChange={e => { setRecipient(e.target.value); token.current = ""; }} /></label>
        <label>{t("Текст сообщения", "Message text")} <textarea ref={editor} required maxLength={500} value={body}
          onChange={e => { setBody(e.target.value); token.current = ""; }} /></label>
        <button disabled={!body.trim() || !recipient.trim()}>{t("Отправить", "Send")}</button>
      </fieldset></form>}
      {sendError && <p role="alert">{sendError === "recipient" ? t("Укажите имя другого игрока с аккаунтом.", "Enter another registered player’s name.") :
        t("Отправка не подтверждена. Повторите попытку.", "Delivery was not confirmed. Try again.")}</p>}
      {loadFailed ? <p role="alert">{t("Не удалось загрузить сообщения.", "Could not load messages.")}</p> : !page && <p>{t("Загрузка…", "Loading…")}</p>}
      {page && <>
        {!page.items.length && <p>{t("Сообщений пока нет.", "No messages yet.")}</p>}
        <ol>{page.items.map(m => <li key={m.seq}>
          <strong>{m.outgoing ? t("Кому", "To") + " " + m.recipient : t("От", "From") + " " + m.sender}</strong>
          {" · "}<time dateTime={new Date(m.created).toISOString()}>{new Date(m.created).toLocaleString(language)}</time>
          <p>{m.body}</p>
          {!m.outgoing && <button disabled={busy} onClick={() => {
            if (recipient !== m.sender) token.current = "";
            setRecipient(m.sender); editor.current?.focus();
          }}>{t("Ответить", "Reply")}</button>}
        </li>)}</ol>
        {before && <button onClick={() => setBefore(undefined)}>{t("К новым", "Newest")}</button>}
        {page.before && <button onClick={() => setBefore(page.before!)}>{t("Более ранние", "Older")}</button>}
      </>}
    </>}
  </main>;
}
