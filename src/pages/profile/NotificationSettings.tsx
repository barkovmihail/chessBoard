import React, { useEffect, useState } from "react";

const labels = { notify_challenge: "Новый вызов", notify_response: "Ответ или отмена вызова" };
type Setting = keyof typeof labels;

async function preferences(body?: { setting: Setting; enabled: boolean }) {
  const res = await fetch("/api/notification-settings", body && { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok || !Object.keys(labels).every(k => typeof data[k] === "boolean")) throw Error();
  return data as Record<Setting, boolean>;
}

export function NotificationSettings() {
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
  return <details><summary>Настройки уведомлений</summary>
    {values && <fieldset disabled={busy}><legend>События</legend>{(Object.keys(labels) as Setting[]).map(k =>
      <label key={k}><input type="checkbox" checked={values[k]} onChange={e => change(k, e.target.checked)} />{labels[k]}</label>)}</fieldset>}
    {error && <p role="alert">Не удалось загрузить настройки. Обновите страницу.</p>}
  </details>;
}
