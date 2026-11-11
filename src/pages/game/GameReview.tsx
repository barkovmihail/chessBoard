import React, { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import type { Game } from "../../features/play";

export function GameReview({ game }: { game: Game }) {
  const [ply, setPly] = useState(game.moves.length);
  const { position, lastMove } = useMemo(() => {
    const board = new Chess();
    let lastMove;
    for (const san of game.moves.slice(0, ply)) lastMove = board.move(san);
    return { position: boardPosition(board), lastMove };
  }, [game.moves, ply]);
  return <>
    <Board position={position} flipped={game.side === "black"} lastMove={lastMove} />
    <nav aria-label="Просмотр партии">
      <p aria-live="polite">{ply ? Math.ceil(ply / 2) + (ply % 2 ? ". " : "… ") + game.moves[ply - 1] : "Начальная позиция"}</p>
      <button disabled={!ply} onClick={() => setPly(0)}>В начало</button>
      <button disabled={!ply} onClick={() => setPly(ply - 1)}>Назад</button>
      <button disabled={ply === game.moves.length} onClick={() => setPly(ply + 1)}>Вперёд</button>
      <button disabled={ply === game.moves.length} onClick={() => setPly(game.moves.length)}>В конец</button>
    </nav>
  </>;
}
