import React, { useCallback } from "react";
import { useLanguage } from "../shared/language";
import { NavIcon } from "./NavIcon";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeSwitch } from "./Appearance";
import { CurrentGames } from "./CurrentGames";
import { Notifications } from "./Notifications";
import type { PanelName } from "./ToolbarPanel";

type Label = [string, string, string];
interface Destination {
  section: string;
  icon: React.ComponentProps<typeof NavIcon>["name"];
  label: Label;
}

const links: Destination[][] = [
  [
    { section: "game", icon: "board", label: ["Игровой зал", "Game lobby", "Sala de juego"] },
    { section: "analysis", icon: "chart", label: ["Анализ", "Analysis", "Análisis"] },
    { section: "openings", icon: "book", label: ["Дебюты", "Openings", "Aperturas"] },
    { section: "puzzles", icon: "puzzle", label: ["Задачи", "Puzzles", "Problemas"] },
    { section: "arenas", icon: "cup", label: ["Арены", "Arenas", "Arenas"] },
  ], [
    { section: "chat", icon: "chat", label: ["Общий чат", "Public chat", "Chat público"] },
    { section: "messages", icon: "mail", label: ["Сообщения", "Messages", "Mensajes"] },
    { section: "teams", icon: "team", label: ["Команды", "Teams", "Equipos"] },
  ], [
    { section: "profile", icon: "account", label: ["Профиль", "Profile", "Perfil"] },
    { section: "settings", icon: "settings", label: ["Настройки", "Settings", "Ajustes"] },
  ],
];
const groupLabels: Label[] = [["За доской", "At the board", "En el tablero"], ["Сообщество", "Community", "Comunidad"], ["Личное", "Personal", "Personal"]];

interface Props {
  section: string;
  game: string | null;
  watch: boolean;
  panel: PanelName | null;
  setPanel: (value: PanelName | null) => void;
}

export function Navigation({ section, game, watch, panel, setPanel }: Props) {
  const { language, t } = useLanguage();
  const training = section === "openings" || section === "puzzles";
  const closePanel = useCallback(() => setPanel(null), [setPanel]);
  const current = links.flat().find(item => item.section === section);
  const group = links.findIndex(items => items.some(item => item.section === section));
  const caption = watch ? t("Просмотр партии", "Watch game", "Ver partida")
    : section === "game" && game ? t("Партия", "Game", "Partida")
    : section === "inbox" ? t("Вызовы и партии", "Challenges and games", "Desafíos y partidas")
    : section === "feed" ? t("Уведомления", "Notifications", "Notificaciones")
    : current ? t(...current.label) : t(...links[0][0].label);
  function href(id: string) {
    if (id === "game") return game && training && !watch ? "?game=" + encodeURIComponent(game) : "/";
    const params = new URLSearchParams({ section: id });
    if ((id === "openings" || id === "puzzles") && game) params.set("game", game);
    return "?" + params.toString();
  }
  return <nav lang={language} className="app-navigation" aria-label={t("Разделы", "Sections", "Secciones")}>
    <div className="app-rail">
      <a className="brand" href="/" aria-label={t("Игровой зал ChessBoard", "ChessBoard lobby", "Sala de juego de ChessBoard")}>
        <span className="brand-knight" aria-hidden="true" />chessBoard
      </a>
      <div className="rail-links">{links.map((items, index) => <div className="rail-group" key={items[0].section}>
        <span className="rail-group-name">{t(...groupLabels[index])}</span>
        {items.map(item => {
          const back = item.section === "game" && training && game && !watch;
          const text = back ? t("Вернуться к партии", "Return to game", "Volver a la partida") : t(...item.label);
          return <a className="rail-link" key={item.section} href={href(item.section)} title={text} aria-label={text}
            aria-current={item.section === section && !(section === "game" && (game || watch)) ? "page" : undefined}>
            <NavIcon name={item.icon} /><span>{text}</span>
          </a>;
        })}
      </div>)}</div>
      <ProfileMenu current={section === "profile"} onInbox={() => setPanel("inbox")} settingsPage={section === "settings"} />
    </div>
    <header className="app-topbar">
      <div className="breadcrumbs"><span>{t(...groupLabels[group < 0 ? 2 : group])}</span><span aria-hidden="true">/</span><strong>{caption}</strong></div>
      <div className="toolbar-actions">
        {section === "inbox" ? <a href="?section=inbox" className="nav-trigger" aria-current="page" aria-label={caption}><NavIcon name="swords" /></a> :
          <CurrentGames open={panel === "inbox"} onToggle={() => setPanel(panel === "inbox" ? null : "inbox")} onClose={closePanel} />}
        {section === "feed" ? <a href="?section=feed" className="nav-trigger" aria-current="page" aria-label={caption}><NavIcon name="bell" /></a> :
          <Notifications open={panel === "feed"} onToggle={() => setPanel(panel === "feed" ? null : "feed")} onClose={closePanel}
            onInbox={() => setPanel("inbox")} />}
        <ThemeSwitch />
      </div>
    </header>
  </nav>;
}
