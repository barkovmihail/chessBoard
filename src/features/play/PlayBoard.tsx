import React, { useState } from "react";
import { Board, initialPosition } from "../../entities/board";
import type { Square } from "../../entities/board";
import type { Game } from "./api";

interface Props {
  game?: Game;
  enabled: boolean;
  onMove: (uci: string) => void;
}

export function PlayBoard({ game, enabled, onMove }: Props) {
  const [selected, select] = useState<Square>();
  const [promotions, setPromotions] = useState<string[]>([]);
  const choices = game?.legal.filter(move => move.startsWith(selected ?? "-")) ?? [];
  function choose(square: Square) {
    setPromotions([]);
    if (selected === square) return select(undefined);
    if (game?.legal.some(move => move.startsWith(square))) return select(square);
    const candidates = choices.filter(move => move.slice(2, 4) === square);
    if (candidates.length > 1) return setPromotions(candidates);
    if (candidates.length === 1) onMove(candidates[0]);
    select(undefined);
  }
  const names: Record<string, string> = { q: "Ферзь", r: "Ладья", b: "Слон", n: "Конь" };
  return <>
    <Board flipped={game?.side === "black"} position={game?.position ?? initialPosition} selected={selected}
      targets={choices.map(move => move.slice(2, 4))} onSquare={enabled ? choose : undefined} />
    {enabled && promotions.map(move => <button key={move} onClick={() => {
      setPromotions([]); select(undefined); onMove(move);
    }}>{names[move[4]]}</button>)}
  </>;
}
