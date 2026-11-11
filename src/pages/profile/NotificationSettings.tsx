import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";

const spanish = { notify_sound: "Sonido de las notificaciones", notify_turn: "Mi turno", notify_finish: "Fin de la partida", notify_challenge: "Nuevo desafío", notify_response: "Desafío respondido o cancelado" };
const english = { notify_sound: "Notification sound", notify_turn: "My turn", notify_finish: "Game ended", notify_challenge: "New challenge", notify_response: "Challenge answered or cancelled" };
const labels = { notify_sound: "Звуковой сигнал уведомлений", notify_turn: "Моя очередь хода", notify_finish: "Завершение партии", notify_challenge: "Новый вызов", notify_response: "Ответ или отмена вызова" };
type Setting = keyof typeof labels;

async function preferences(body?: { setting: Setting; enabled: boolean }) {
  const res = await fetch("/api/notification-settings", body && { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok || !Object.keys(labels).every(k => typeof data[k] === "boolean")) throw Error();
  return data as Record<Setting, boolean>;
}

export function NotificationSettings() {
  const { t } = useLanguage();
  const [values, setValues] = useState<Record<Setting, boolean>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    preferences().then(v => { if (active) setValues(v); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  async function change(setting: Setting, enabled: boolean) {
    if (!values) return;
    const previous = values;
    setValues({ ...values, [setting]: enabled });
    setBusy(true);
    try { setValues(await preferences({ setting, enabled })); setError(false); }
    catch { setValues(previous); setError(true); }
    finally { setBusy(false); }
  }
  return <details id="notification-settings" open={new URLSearchParams(location.search).get("settings") === "1" || undefined}><summary>{t("Настройки уведомлений", "Notification settings", "Ajustes de notificaciones")}</summary>
    {values && <fieldset disabled={busy}><legend>{t("События", "Events", "Eventos")}</legend>{(Object.keys(labels) as Setting[]).map(k =>
      <label key={k}><input type="checkbox" checked={values[k]} onChange={e => change(k, e.target.checked)} />{t(labels[k], english[k], spanish[k])}</label>)}</fieldset>}
    {error && <p role="alert">{t("Не удалось загрузить настройки. Обновите страницу.", "Could not load settings. Reload the page.", "No se pudieron cargar los ajustes. Recarga la página.")}</p>}
  </details>;
}
