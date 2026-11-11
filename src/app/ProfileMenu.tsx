import React, { useEffect, useRef, useState } from "react";
import { Appearance } from "./Appearance";
import { Sound } from "./Sound";

export function ProfileMenu({ onInbox, current }: { onInbox: () => void; current: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/account", { signal: abort.signal, cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok || !(data.name === null || typeof data.name === "string")) throw Error();
      if (!abort.signal.aborted) { setName(data.name); setError(""); }
    }).catch(() => { if (!abort.signal.aborted) setError("Не удалось загрузить аккаунт."); });
    return () => abort.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (menu.current && !menu.current.contains(e.target as Node)) menu.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/account/logout", { method: "POST" });
      if (!response.ok) throw Error();
      location.assign("?section=profile");
    } catch { setError("Не удалось выйти. Повторите попытку."); setBusy(false); }
  }
  return <details ref={menu} className="profile-menu" onToggle={e => {
    setOpen(e.currentTarget.open);
    if (!e.currentTarget.open) e.currentTarget.querySelectorAll("details").forEach(d => { d.open = false; });
  }} onKeyDown={e => {
    if (e.key === "Escape" && menu.current) {
      menu.current.open = false;
      trigger.current?.focus();
    }
  }}>
    <summary ref={trigger} aria-label="Меню профиля">{name ?? "Профиль"}</summary>
    <div className="profile-panel">
      <a href="?section=profile" aria-current={current ? "page" : undefined}>Профиль</a>
      {name === null && <a href="?section=profile#account">Войти</a>}
      {name && <>
        <button onClick={() => { if (menu.current) menu.current.open = false; onInbox(); }}>Входящие</button>
        <a href="?section=profile&settings=1#notification-settings">Настройки</a>
        <button disabled={busy} onClick={logout}>Выйти</button>
      </>}
      {error && <p role="alert">{error}</p>}
      <Sound /><Appearance />
    </div>
  </details>;
}
