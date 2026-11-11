import { useLanguage } from "../shared/language";
import React, { useEffect, useState } from "react";
import { playSound, readSound, saveSound, SoundSettings, unlockSound } from "../shared/sound";

export function Sound() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(readSound);
  useEffect(() => {
    window.addEventListener("pointerup", unlockSound, true);
    window.addEventListener("keydown", unlockSound, true);
    return () => {
      window.removeEventListener("pointerup", unlockSound, true);
      window.removeEventListener("keydown", unlockSound, true);
    };
  }, []);
  function change(next: SoundSettings) {
    saveSound(next);
    setSettings(next);
    if (next.enabled) unlockSound();
  }
  return <details className="appearance"><summary>{t("Звук", "Sound", "Sonido")}</summary>
    <div className="appearance-options">
      <label><input type="checkbox" checked={settings.enabled}
        onChange={e => change({ ...settings, enabled: e.target.checked })} />{t("Звуки игры", "Game sounds", "Sonidos de la partida")}</label>
      <label>{t("Громкость", "Volume", "Volumen")} <input type="range" min="0" max="100" value={settings.volume}
        onChange={e => change({ ...settings, volume: Number(e.target.value) })} />{settings.volume}%</label>
      <span>{t("Ход фигуры · Алебастр", "Piece move · Alabaster", "Movimiento de pieza · Alabaster")}</span>
      <button disabled={!settings.enabled || !settings.volume} onClick={() => playSound("move")}>{t("Прослушать", "Preview", "Escuchar")}</button>
    </div>
  </details>;
}
