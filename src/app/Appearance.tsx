import React, { useEffect, useState } from "react";

import { KnightPreview } from "../entities/board";

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
    <div className="appearance-options">
      {keys.map(key => <fieldset key={key}><legend>{labels[key]}</legend>
        {Object.entries(options[key]).map(([value, label]) => <label key={value}>
          <input type="radio" name={key} checked={settings[key] === value}
            onChange={() => setSettings({ ...settings, [key]: value })} />
          {key === "pieces" && <KnightPreview set={value} />}
          {key === "board" && <span aria-hidden="true" className={"palette " + value} />}
          {label}
        </label>)}
      </fieldset>)}
    </div>
  </details>;
}
