import React, { useId } from "react";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../entities/board";
import { useLanguage } from "../shared/language";
import { Appearance, ThemeSwitch } from "./Appearance";
import { Sound } from "./Sound";

const preview = boardPosition(new Chess("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"));

export function LanguageOptions() {
  const { language, select, t } = useLanguage();
  const group = useId();
  return <details className="appearance"><summary>{t("Язык (Language)", "Language", "Idioma")}</summary>
    <fieldset><legend>{t("Язык интерфейса", "Interface language", "Idioma de la interfaz")}</legend>
      {(["ru", "en", "es"] as const).map(code => <label key={code} lang={code}>
        <input type="radio" name={group} checked={language === code} onChange={() => select(code)} />
        {{ ru: "Русский", en: "English", es: "Español" }[code]}
      </label>)}
    </fieldset>
  </details>;
}

export function SettingsPage() {
  const { t } = useLanguage();
  return <main className="atlas-page settings-page">
    <h1 className="atlas-heading">{t("Оформление и звук", "Appearance and sound", "Apariencia y sonido")}</h1>
    <div className="atlas-columns">
      <section className="atlas-card settings-controls">
        <h2>{t("Настройки интерфейса", "Interface settings", "Ajustes de la interfaz")}</h2><Appearance expanded />
        <Sound /><LanguageOptions />
        <a href="?section=profile&settings=1#notification-settings">{t("Настройки уведомлений", "Notification settings", "Ajustes de notificaciones")}</a>
      </section>
      <aside className="atlas-card settings-preview"><h2>{t("Образец доски", "Board preview", "Vista previa del tablero")}</h2>
        <Board position={preview} highlight="g1f3" /><ThemeSwitch showLabel />
      </aside>
    </div>
  </main>;
}
