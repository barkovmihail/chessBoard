import React from "react";
import { Appearance } from "./Appearance";
import { ProfilePage } from "../pages/profile";
import { GamePage } from "../pages/game";
import { OpeningsPage } from "../pages/openings";
import { PuzzlesPage } from "../pages/puzzles";

export default function App() {
  const query = typeof window === "undefined" ? "" : location.search;
  const section = new URLSearchParams(query).get("section");
  return <>
    <nav className="study-nav" aria-label="Разделы">
      <a href={section ? "/" : query || "/"} aria-current={!section ? "page" : undefined}>Игра</a>
      <a href="?section=openings" aria-current={section === "openings" ? "page" : undefined}>Тренажёр дебютов</a>
      <a href="?section=puzzles" aria-current={section === "puzzles" ? "page" : undefined}>Шахматные задачи</a>
      <a href="?section=profile" aria-current={section === "profile" ? "page" : undefined}>Профиль</a>
      <Appearance />
    </nav>
    {section === "profile" ? <ProfilePage /> : section === "openings" ? <OpeningsPage /> : section === "puzzles" ? <PuzzlesPage /> : <GamePage />}
  </>;
}
