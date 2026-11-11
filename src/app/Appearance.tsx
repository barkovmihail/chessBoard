import React, { useEffect, useState } from "react";

const options = {
  board: { brown: "Классическая", green: "Зелёная", blue: "Голубая" },
  pieces: { cburnett: "Cburnett", merida: "Merida", alpha: "Alpha" },
  theme: { light: "Светлая", dark: "Тёмная" },
};
type Setting = keyof typeof options;
type Settings = Record<Setting, string>;
const defaults: Settings = { board: "brown", pieces: "cburnett", theme: "light" };
const keys = Object.keys(options) as Setting[];
const labels = { board: "Доска", pieces: "Фигуры", theme: "Тема" };
const storageKey = "chessboard.appearance";

function readSettings() {
  const result = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    for (const key of keys) {
      if (Object.keys(options[key]).includes(saved?.[key])) result[key] = saved[key];
    }
  } catch { /* The defaults also work when browser storage is unavailable. */ }
  return result;
}

export function Appearance() {
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    for (const key of keys) document.documentElement.dataset[key] = settings[key];
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Session-only settings. */ }
  }, [settings]);
  return <details className="appearance"><summary>Оформление</summary>
    <div className="appearance-options">{keys.map(key => <label key={key}>{labels[key]}
      <select value={settings[key]} aria-label={labels[key]} onChange={event =>
        setSettings({ ...settings, [key]: event.target.value })}>
        {Object.entries(options[key]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>)}</div>
  </details>;
}
