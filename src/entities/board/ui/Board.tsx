import React from "react";
import { files, ranks } from "../model/position";
import type { BoardPiece, Square } from "../model/position";
import styles from "./board.module.css";
import pieces from "./pieces.module.css";

interface BoardProps {
  position: readonly BoardPiece[];
  selected?: Square;
  flipped?: boolean;
  targets?: readonly string[];
  onSquare?: (square: Square) => void;
}

export function Board({ position, selected, targets, onSquare, flipped }: BoardProps) {
  const occupied = new Map(position.map(piece => [piece.square, piece]));
  const visibleFiles = flipped ? [...files].reverse() : files;
  const visibleRanks = flipped ? [...ranks].reverse() : ranks;
  return (
    <div className={styles.board}>
      <div className={styles.cells}>
        {visibleRanks.map((rank, row) => visibleFiles.map((file, column) => {
          const square: Square = `${file}${rank}`;
          const piece = occupied.get(square);
          return (
            <button type="button" key={square} data-square={square} aria-label={square}
              disabled={!onSquare} aria-pressed={selected === square} data-target={targets?.includes(square)}
              onClick={() => onSquare?.(square)}
              className={(row + column) % 2 === 0 ? styles.light : styles.dark}>
              {piece && <div role="img" aria-label={`${piece.color} ${piece.type} ${square}`}
                className={[pieces.piece, pieces[piece.color], pieces[piece.type]].join(" ")} />}
            </button>
          );
        }))}
      </div>
      <div className={styles.ranks}>{visibleRanks.map(rank => <span key={rank}>{rank}</span>)}</div>
      <div className={styles.files}>{visibleFiles.map(file => <span key={file}>{file.toUpperCase()}</span>)}</div>
    </div>
  );
}
