import React, { useState } from "react";
import { MessagesPage } from "../pages/messages";
import { ChatPage } from "../pages/chat";
import { TeamsPage } from "../pages/teams";
import { ArenasPage } from "../pages/arenas";
import { AnalysisPage } from "../pages/analysis";
import { ProfilePage } from "../pages/profile";
import { GamePage, WatchPage } from "../pages/game";
import { OpeningsPage } from "../pages/openings";
import { PuzzlesPage } from "../pages/puzzles";
import { CurrentGames } from "./CurrentGames";
import { Navigation } from "./Navigation";
import { Notifications } from "./Notifications";
import { SettingsPage } from "./SettingsPage";
import type { PanelName } from "./ToolbarPanel";
import { useLanguage } from "../shared/language";

export default function App() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : location.search);
  const section = params.get("section") ?? "game";
  const watch = params.get("watch");
  const [game, setGame] = useState(params.get("game"));
  const { t } = useLanguage();
  const [panel, setPanel] = useState<PanelName | null>(null);
  function openGame(id: string) {
    history.replaceState(null, "", "?game=" + encodeURIComponent(id));
    setGame(id);
  }
  function page() {
    if (watch) return <WatchPage token={watch} />;
    switch (section) {
      case "messages": return <MessagesPage />;
      case "chat": return <ChatPage />;
      case "teams": return <TeamsPage />;
      case "arenas": return <ArenasPage />;
      case "analysis": return <AnalysisPage />;
      case "profile": return <ProfilePage onInbox={() => setPanel("inbox")} />;
      case "openings": return <OpeningsPage />;
      case "puzzles": return <PuzzlesPage />;
      case "settings": return <SettingsPage />;
      case "inbox": return <CurrentGames open fullPage />;
      case "feed": return <Notifications open fullPage onInbox={() => location.assign("?section=inbox")} />;
      default: return <GamePage onOpen={openGame} />;
    }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault();
      document.getElementById("main-content")?.focus();
    }}>{t("К содержимому", "Skip to content", "Saltar al contenido")}</a>
    <Navigation section={section} game={game} watch={!!watch} panel={panel} setPanel={setPanel} />
    <div className="app-content" id="main-content" tabIndex={-1}>{page()}</div>
  </div>;
}
