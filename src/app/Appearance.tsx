import { useLanguage } from "../shared/language";
import React, { createContext, useContext, useEffect, useId, useState } from "react";
import { NavIcon } from "./NavIcon";

import { KnightPreview } from "../entities/board";

const options = {
  board: { brown: "Классическая", green: "Зелёная", blue: "Голубая" },
  pieces: { cburnett: "Cburnett", merida: "Merida", alpha: "Alpha" },
  theme: { light: "Светлая", dark: "Тёмная" },
};
type Setting = keyof typeof options;
type Settings = Record<Setting, string>;
const defaults: Settings = { board: "green", pieces: "merida", theme: "light" };
const keys = Object.keys(options) as Setting[];
const english: Record<string, string> = { board: "Board", pieces: "Pieces", theme: "Theme", brown: "Classic", green: "Green", blue: "Blue", light: "Light", dark: "Dark" };
const spanish: Record<string, string> = { board: "Tablero", pieces: "Piezas", theme: "Tema", brown: "Clásico", green: "Verde", blue: "Azul", light: "Claro", dark: "Oscuro" };
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

const AppearanceContext = createContext({ settings: defaults, change: (_key: Setting, _value: string) => {} });

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => {
    for (const key of keys) document.documentElement.dataset[key] = settings[key];
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", settings.theme === "dark" ? "#211e25" : "#f4f1ea");
  }, [settings]);
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) setSettings(readSettings());
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function change(key: Setting, value: string) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the selection for this session. */ }
  }
  return <AppearanceContext.Provider value={{ settings, change }}>{children}</AppearanceContext.Provider>;
}

export function ThemeSwitch({ showLabel = false }: { showLabel?: boolean }) {
  const { t } = useLanguage();
  const { settings, change } = useContext(AppearanceContext);
  const dark = settings.theme === "dark";
  const label = showLabel ? t("Переключить тему", "Switch theme", "Cambiar tema") : t("Тёмная тема", "Dark theme", "Tema oscuro");
  return <button type="button" className={showLabel ? "preview-switch" : "nav-trigger theme-switch"} title={label} aria-label={label} aria-pressed={dark}
    onClick={() => change("theme", dark ? "light" : "dark")}><NavIcon name={dark ? "moon" : "sun"} />{showLabel && label}</button>;
}

export function Appearance({ expanded = false }: { expanded?: boolean }) {
  const { t } = useLanguage();
  const { settings, change } = useContext(AppearanceContext);
  const group = useId();
  const fields = expanded ? (["theme", "board", "pieces"] as const) : keys;
  const controls = <div className="appearance-options">
      {fields.map(key => expanded && key !== "theme" ? <label className="appearance-select" key={key}>
        {t(labels[key], english[key], spanish[key])}
        <select value={settings[key]} onChange={event => change(key, event.target.value)}>
          {Object.entries(options[key]).map(([value, label]) => <option value={value} key={value}>{t(label, english[value] ?? label, spanish[value] ?? label)}</option>)}
        </select>
      </label> : <fieldset key={key}><legend>{t(labels[key], english[key], spanish[key])}</legend>
        {Object.entries(options[key]).map(([value, label]) => <label key={value}>
          <input type="radio" name={group + key} checked={settings[key] === value}
            onChange={() => change(key, value)} />
          {key === "pieces" && <KnightPreview set={value} />}
          {key === "board" && <span aria-hidden="true" className={"palette " + value} />}
          {t(label, english[value] ?? label, spanish[value] ?? label)}
        </label>)}
      </fieldset>)}
    </div>;
  return expanded ? controls : <details className="appearance"><summary>{t("Оформление", "Appearance", "Apariencia")}</summary>{controls}</details>;
}
