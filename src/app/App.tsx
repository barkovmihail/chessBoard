import { NavIcon } from "./NavIcon";
import { useLanguage } from "../shared/language";
import React, { useState } from "react";
import { MessagesPage } from "../pages/messages";
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
    <nav lang={language} className="study-nav" aria-label={t("Разделы", "Sections", "Secciones")}>
      <a className="brand" href="/" aria-label={t("Игровой зал ChessBoard", "ChessBoard lobby", "Sala de juego de ChessBoard")}><img src="/staunton.svg" alt="" />ChessBoard</a>
      <a href={game && (training || !section) ? gameQuery : section || watch ? "/" : query || "/"} aria-current={!section ? "page" : undefined}><NavIcon name="board" />{training && game ? t("Вернуться к партии", "Return to game", "Volver a la partida") : t("Игра", "Play", "Jugar")}</a>
      <a href={"?section=openings" + trainingSuffix} title={t("Тренажёр дебютов", "Opening trainer", "Entrenador de aperturas")} aria-label={t("Тренажёр дебютов", "Opening trainer", "Entrenador de aperturas")} aria-current={section === "openings" ? "page" : undefined}><NavIcon name="book" />{t("Тренажёр дебютов", "Opening trainer", "Entrenador de aperturas")}</a>
      <a href={"?section=puzzles" + trainingSuffix} title={t("Шахматные задачи", "Puzzles", "Problemas de ajedrez")} aria-label={t("Шахматные задачи", "Puzzles", "Problemas de ajedrez")} aria-current={section === "puzzles" ? "page" : undefined}><NavIcon name="puzzle" /></a>
      <a href="?section=analysis" title={t("Анализ", "Analysis", "Análisis")} aria-label={t("Анализ", "Analysis", "Análisis")} aria-current={section === "analysis" ? "page" : undefined}><NavIcon name="chart" />{t("Анализ", "Analysis", "Análisis")}</a>
      <a href="?section=arenas" title={t("Турниры", "Tournaments", "Torneos")} aria-label={t("Турниры", "Tournaments", "Torneos")} aria-current={section === "arenas" ? "page" : undefined}><NavIcon name="cup" /></a>
      <a href="?section=chat" title={t("Чат", "Chat", "Chat")} aria-label={t("Чат", "Chat", "Chat")} aria-current={section === "chat" ? "page" : undefined}><NavIcon name="chat" /></a>
      <CurrentGames open={gamesOpen} setOpen={setGamesOpen} /><Notifications onInbox={() => setGamesOpen(true)} /><ProfileMenu current={section === "profile"} onInbox={() => setGamesOpen(true)} />
    </nav>
    {watch ? <WatchPage token={watch} /> : section === "messages" ? <MessagesPage /> : section === "chat" ? <ChatPage /> : section === "teams" ? <TeamsPage /> : section === "arenas" ? <ArenasPage /> : section === "analysis" ? <AnalysisPage /> : section === "profile" ? <ProfilePage onInbox={() => setGamesOpen(true)} /> : section === "openings" ? <OpeningsPage /> : section === "puzzles" ? <PuzzlesPage /> : <GamePage onOpen={openGame} />}
  </>;
}
