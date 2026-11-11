import { useLanguage } from "../shared/language";
import React, { useState } from "react";
import { ChatPage } from "../pages/chat";
import { TeamsPage } from "../pages/teams";
import { ArenasPage } from "../pages/arenas";
import { ProfileMenu } from "./ProfileMenu";
import { Notifications } from "./Notifications";
import { CurrentGames } from "./CurrentGames";
import { AnalysisPage } from "../pages/analysis";
import { ProfilePage } from "../pages/profile";
import { GamePage, WatchPage } from "../pages/game";
import { OpeningsPage } from "../pages/openings";
import { PuzzlesPage } from "../pages/puzzles";

export default function App() {
  const { language, t } = useLanguage();
  const query = typeof window === "undefined" ? "" : location.search;
  const params = new URLSearchParams(query);
  const section = params.get("section");
  const [game, setGame] = useState(params.get("game"));
  const [gamesOpen, setGamesOpen] = useState(false);
  const watch = params.get("watch");
  const training = section === "openings" || section === "puzzles";
  const gameQuery = game ? "?game=" + encodeURIComponent(game) : "/";
  const trainingSuffix = game ? "&game=" + encodeURIComponent(game) : "";
  function openGame(id: string) {
    history.replaceState(null, "", "?game=" + encodeURIComponent(id));
    setGame(id);
  }
  return <>
    <nav lang={language} className="study-nav" aria-label={t("Разделы", "Sections")}>
      <a href={game && (training || !section) ? gameQuery : section || watch ? "/" : query || "/"} aria-current={!section ? "page" : undefined}>{training && game ? t("Вернуться к партии", "Return to game") : t("Игра", "Play")}</a>
      <a href={"?section=openings" + trainingSuffix} aria-current={section === "openings" ? "page" : undefined}>{t("Тренажёр дебютов", "Opening trainer")}</a>
      <a href={"?section=puzzles" + trainingSuffix} aria-current={section === "puzzles" ? "page" : undefined}>{t("Шахматные задачи", "Puzzles")}</a>
      <a href="?section=analysis" aria-current={section === "analysis" ? "page" : undefined}>{t("Анализ", "Analysis")}</a>
      <a href="?section=arenas" aria-current={section === "arenas" ? "page" : undefined}>{t("Турниры", "Tournaments")}</a>
      <a href="?section=chat" aria-current={section === "chat" ? "page" : undefined}>{t("Чат", "Chat")}</a>
      <CurrentGames open={gamesOpen} setOpen={setGamesOpen} /><Notifications onInbox={() => setGamesOpen(true)} /><ProfileMenu current={section === "profile"} onInbox={() => setGamesOpen(true)} />
    </nav>
    {watch ? <WatchPage token={watch} /> : section === "chat" ? <ChatPage /> : section === "teams" ? <TeamsPage /> : section === "arenas" ? <ArenasPage /> : section === "analysis" ? <AnalysisPage /> : section === "profile" ? <ProfilePage onInbox={() => setGamesOpen(true)} /> : section === "openings" ? <OpeningsPage /> : section === "puzzles" ? <PuzzlesPage /> : <GamePage onOpen={openGame} />}
  </>;
}
