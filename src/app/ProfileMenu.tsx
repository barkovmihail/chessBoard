import { NavIcon } from "./NavIcon";
import { useLanguage } from "../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { ConnectionStatus, useConnectionSample } from "./ConnectionStatus";
import { Appearance } from "./Appearance";
import { Sound } from "./Sound";
import { LanguageOptions } from "./SettingsPage";

export function ProfileMenu({ onInbox, current, settingsPage }: { onInbox: () => void; current: boolean; settingsPage: boolean }) {
  const { language, t } = useLanguage();
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const sample = useConnectionSample(open);
  const [name, setName] = useState<string | null>();
  const [error, setError] = useState<"account" | "logout" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/account", { signal: abort.signal, cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok || !(data.name === null || typeof data.name === "string")) throw Error();
      if (!abort.signal.aborted) { setName(data.name); setError(null); }
    }).catch(() => { if (!abort.signal.aborted) setError("account"); });
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
    } catch { setError("logout"); setBusy(false); }
  }
  return <details lang={language} ref={menu} className="profile-menu" onToggle={e => {
    setOpen(e.currentTarget.open);
    if (!e.currentTarget.open) e.currentTarget.querySelectorAll("details").forEach(d => { d.open = false; });
  }} onKeyDown={e => {
    if (e.key === "Escape" && menu.current) {
      menu.current.open = false;
      trigger.current?.focus();
    }
  }}>
    <summary className="profile-trigger" title={name ?? t("Профиль", "Profile", "Perfil")} ref={trigger} aria-label={t("Меню профиля", "Profile menu", "Menú de perfil")}>
      <span className="user-avatar">{name ? name.slice(0, 1).toUpperCase() : <NavIcon name="account" />}</span>
      <span className="user-caption"><strong>{name ?? t("Гость", "Guest", "Invitado")}</strong><small>{t("Меню профиля", "Profile menu", "Menú de perfil")}</small></span>
    </summary>
    <div className="profile-panel">{name && <strong>{name}</strong>}
      <a href="?section=profile" aria-current={current ? "page" : undefined}>{t("Профиль", "Profile", "Perfil")}</a>
      {name && <span role="status" className="profile-presence" data-online={!!sample && sample !== "offline"}>
        {sample === null ? t("Проверяем связь…", "Checking connection…", "Comprobando la conexión…") : sample === "offline" ? t("Не в сети", "Offline", "Sin conexión") : t("В сети", "Online", "En línea")}
      </span>}
      {name === null && <a href="?section=profile#account">{t("Войти", "Sign in", "Iniciar sesión")}</a>}
      {name && <>
        <button onClick={() => { if (menu.current) menu.current.open = false; onInbox(); }}>{t("Входящие", "Inbox", "Bandeja de entrada")}</button>
        <a href="?section=profile&settings=1#notification-settings">{t("Настройки", "Settings", "Ajustes")}</a>
        <button disabled={busy} onClick={logout}>{t("Выйти", "Sign out", "Cerrar sesión")}</button>
      </>}
      {error && <p role="alert">{error === "account" ? t("Не удалось загрузить аккаунт.", "Could not load your account.", "No se pudo cargar tu cuenta.") : t("Не удалось выйти. Повторите попытку.", "Could not sign out. Try again.", "No se pudo cerrar la sesión. Inténtalo de nuevo.")}</p>}
      <LanguageOptions />
      {!settingsPage && <Sound />}<Appearance />
      {open && <ConnectionStatus sample={sample} />}
    </div>
  </details>;
}
