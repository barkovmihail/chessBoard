import { useLanguage } from "../shared/language";
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
const english: Record<string, string> = { board: "Board", pieces: "Pieces", theme: "Theme", brown: "Classic", green: "Green", blue: "Blue", light: "Light", dark: "Dark" };
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
  const { language, t } = useLanguage();
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    for (const key of keys) document.documentElement.dataset[key] = settings[key];
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Session-only settings. */ }
  }, [settings]);
  return <details className="appearance"><summary>{t("Оформление", "Appearance")}</summary>
    <div className="appearance-options">
      {keys.map(key => <fieldset key={key}><legend>{t(labels[key], english[key])}</legend>
        {Object.entries(options[key]).map(([value, label]) => <label key={value}>
          <input type="radio" name={key} checked={settings[key] === value}
            onChange={() => setSettings({ ...settings, [key]: value })} />
          {key === "pieces" && <KnightPreview set={value} />}
          {key === "board" && <span aria-hidden="true" className={"palette " + value} />}
          {language === "en" ? english[value] ?? label : label}
        </label>)}
      </fieldset>)}
    </div>
  </details>;
}
