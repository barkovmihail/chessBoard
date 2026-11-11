import React, { useState } from "react";
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
    <nav className="study-nav" aria-label="Разделы">
      <a href={game && (training || !section) ? gameQuery : section || watch ? "/" : query || "/"} aria-current={!section ? "page" : undefined}>{training && game ? "Вернуться к партии" : "Игра"}</a>
      <a href={"?section=openings" + trainingSuffix} aria-current={section === "openings" ? "page" : undefined}>Тренажёр дебютов</a>
      <a href={"?section=puzzles" + trainingSuffix} aria-current={section === "puzzles" ? "page" : undefined}>Шахматные задачи</a>
      <a href="?section=analysis" aria-current={section === "analysis" ? "page" : undefined}>Анализ</a>
      <a href="?section=arenas" aria-current={section === "arenas" ? "page" : undefined}>Турниры</a>
      <CurrentGames open={gamesOpen} setOpen={setGamesOpen} /><Notifications onInbox={() => setGamesOpen(true)} /><ProfileMenu current={section === "profile"} onInbox={() => setGamesOpen(true)} />
    </nav>
    {watch ? <WatchPage token={watch} /> : section === "teams" ? <TeamsPage /> : section === "arenas" ? <ArenasPage /> : section === "analysis" ? <AnalysisPage /> : section === "profile" ? <ProfilePage onInbox={() => setGamesOpen(true)} /> : section === "openings" ? <OpeningsPage /> : section === "puzzles" ? <PuzzlesPage /> : <GamePage onOpen={openGame} />}
  </>;
}
