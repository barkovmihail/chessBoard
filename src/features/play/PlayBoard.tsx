import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { Board, initialPosition } from "../../entities/board";
import type { Square } from "../../entities/board";
import type { Game } from "./api";

interface Props {
  game?: Pick<Game, "legal" | "position" | "turn" | "side" | "last_uci">;
  enabled: boolean;
  positionKey?: string | number;
  onMove: (uci: string) => void;
}

export function PlayBoard({ game, enabled, positionKey, onMove }: Props) {
  const { t } = useLanguage();
  const [selected, select] = useState<Square>();
  const [promotions, setPromotions] = useState<string[]>([]);
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    select(undefined);
    setPromotions([]);
  }, [positionKey]);
  const choices = game?.legal.filter(move => move.startsWith(selected ?? "-")) ?? [];
  function choose(square: Square) {
    setPromotions([]);
    if (selected === square) return select(undefined);
    if (selected && choices.some(move => move.slice(2, 4) === square)) return drop(selected, square);
    if (game?.legal.some(move => move.startsWith(square))) return select(square);
    if (selected) drop(selected, square);
  }
  function drop(from: Square, to: Square) {
    setPromotions([]);
    const candidates = game?.legal.filter(move => move.startsWith(from + to)) ?? [];
    if (candidates.length > 1) return setPromotions(candidates);
    if (candidates.length === 1) onMove(candidates[0]);
    select(undefined);
  }
  const names: Record<string, string> = { q: t("Ферзь", "Queen", "Dama"), r: t("Ладья", "Rook", "Torre"), b: t("Слон", "Bishop", "Alfil"), n: t("Конь", "Knight", "Caballo") };
  return <div ref={workspace}>
    <Board flipped={game?.side === "black"} position={game?.position ?? initialPosition} selected={selected} highlight={game?.last_uci ?? undefined}
      movableColor={game?.turn} onMove={enabled ? drop : undefined}
      targets={choices.map(move => move.slice(2, 4))} onSquare={enabled ? choose : undefined} />
    {enabled && promotions.length > 0 && <fieldset><legend>{t("Превращение пешки", "Pawn promotion", "Promoción del peón")}</legend>
      {promotions.map((move, index) => <button key={move} autoFocus={index === 0} onClick={() => {
        workspace.current?.querySelector<HTMLButtonElement>(`[data-square="${move.slice(2, 4)}"]`)?.focus();
        setPromotions([]); select(undefined); onMove(move);
      }}>{names[move[4]]}</button>)}
    </fieldset>}
  </div>;
}
