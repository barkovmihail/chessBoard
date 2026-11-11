import React from "react";
import { files, ranks } from "../model/position";
import type { BoardPiece, Square } from "../model/position";
import styles from "./board.module.css";
import pieces from "./pieces.module.css";

export function Board({ position }: { position: readonly BoardPiece[] }) {
  const occupied = new Map(position.map(piece => [piece.square, piece]));
  return (
    <div className={styles.board}>
      <div className={styles.cells}>
        {ranks.map((rank, row) => files.map((file, column) => {
          const square: Square = `${file}${rank}`;
          const piece = occupied.get(square);
          return (
            <div key={square} data-square={square}
              className={(row + column) % 2 === 0 ? styles.light : styles.dark}>
              {piece && <div role="img" aria-label={`${piece.color} ${piece.type} ${square}`}
                className={[pieces.piece, pieces[piece.color], pieces[piece.type]].join(" ")} />}
            </div>
          );
        }))}
      </div>
      <div className={styles.ranks}>{ranks.map(rank => <span key={rank}>{rank}</span>)}</div>
      <div className={styles.files}>{files.map(file => <span key={file}>{file.toUpperCase()}</span>)}</div>
    </div>
  );
}
