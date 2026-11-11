import { useLanguage } from "../../shared/language";
import React, { useMemo, useState } from "react";
import { EngineAnalysis } from "./EngineAnalysis";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import type { Game } from "../../features/play";

export function GameReview({ game, render }: {
  game: Game; render: (board: React.ReactElement, controls: React.ReactElement) => React.ReactElement;
}) {
  const { language, t } = useLanguage();
  const [ply, setPly] = useState(game.moves.length);
  const { position, lastMove } = useMemo(() => {
    if (game.review960) return { position: boardPosition(new Chess(game.review960.fens[ply])), lastMove: undefined };
    const board = new Chess();
    let lastMove;
    for (const san of game.moves.slice(0, ply)) lastMove = board.move(san);
    return { position: boardPosition(board), lastMove };
  }, [game.moves, game.review960, ply]);
  const pgn = useMemo(() => {
    if (game.review960) return game.review960.pgn;
    const board = new Chess();
    game.moves.forEach(move => board.move(move));
    board.setHeader("Result", game.result ?? "*");
    if (game.clock) board.setHeader("TimeControl", game.clock.base_minutes * 60 + "+" + game.clock.increment_seconds);
    return board.pgn();
  }, [game]);
  return render(<Board position={position} flipped={game.side === "black"} lastMove={lastMove} highlight={game.review960?.uci?.[ply - 1]} />, <>
    <nav lang={language} aria-label={t("Просмотр партии", "Game replay")}>
      <p aria-live="polite">{ply ? Math.ceil(ply / 2) + (ply % 2 ? ". " : "… ") + game.moves[ply - 1] : t("Начальная позиция", "Starting position")}</p>
      <button disabled={!ply} onClick={() => setPly(0)}>{t("В начало", "Go to start")}</button>
      <button disabled={!ply} onClick={() => setPly(ply - 1)}>{t("Назад", "Previous move")}</button>
      <button disabled={ply === game.moves.length} onClick={() => setPly(ply + 1)}>{t("Вперёд", "Next move")}</button>
      <button disabled={ply === game.moves.length} onClick={() => setPly(game.moves.length)}>{t("В конец", "Go to end")}</button>
    </nav>
    <EngineAnalysis id={game.id} ply={ply} initial={game.engine_name ?? "lc0"} />
    <a href={"data:application/x-chess-pgn;charset=utf-8," + encodeURIComponent(pgn)}
      download={game.id + ".pgn"}>{t("Скачать PGN", "Download PGN")}</a>
    {game.chess960 == null && <a href={"?section=analysis&game=" + game.id + "&ply=" + ply}>{t("Разобрать позицию", "Analyze position")}</a>}
  </>);
}
