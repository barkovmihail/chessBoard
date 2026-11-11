import React from "react";
import { files, ranks } from "../model/position";
import type { BoardPiece, Square } from "../model/position";
import styles from "./board.module.css";
import { usePieceDrag } from "./usePieceDrag";
import pieces from "./pieces.module.css";

interface BoardProps {
  position: readonly BoardPiece[];
  selected?: Square;
  flipped?: boolean;
  lastMove?: { from: Square; to: Square };
  highlight?: string;
  targets?: readonly string[];
  onMove?: (from: Square, to: Square) => void;
  movableColor?: BoardPiece["color"] | "white" | "black";
  onSquare?: (square: Square) => void;
}

export function Board({ position, selected, targets, onSquare, flipped, lastMove, highlight, onMove, movableColor }: BoardProps) {
  const pointer = usePieceDrag(onMove);
  const squares = highlight ?? (lastMove && lastMove.from + lastMove.to);
  const occupied = new Map(position.map(piece => [piece.square, piece]));
  const visibleFiles = flipped ? [...files].reverse() : files;
  const visibleRanks = flipped ? [...ranks].reverse() : ranks;
  return (
    <div className={styles.board}>
      <div className={styles.cells}>
        {visibleRanks.map((rank, row) => visibleFiles.map((file, column) => {
          const square: Square = `${file}${rank}`;
          const piece = occupied.get(square);
          const dragging = pointer.drag?.square === square ? pointer.drag : undefined;
          const movable = !!piece && piece.color === movableColor && !!onMove;
          const animate = piece && lastMove?.to === square;
          const offset = animate && lastMove ? {
            "--from-x": (visibleFiles.indexOf(lastMove.from[0] as typeof files[number]) - column) * 100 + "%",
            "--from-y": (visibleRanks.indexOf(Number(lastMove.from[1]) as typeof ranks[number]) - row) * 100 + "%",
          } as React.CSSProperties : undefined;
          return (
            <button type="button" key={square} data-square={square} aria-label={square}
              disabled={!onSquare} aria-pressed={selected === square} data-target={targets?.includes(square)}
              data-last-move={squares && (square === squares.slice(0, 2) || square === squares.slice(2, 4)) || undefined}
              data-movable={movable}
              onPointerDown={event => pointer.start(event, square, movable)}
              onPointerMove={pointer.move} onPointerUp={event => pointer.end(event, true)}
              onPointerCancel={event => pointer.end(event, false)} onLostPointerCapture={event => pointer.end(event, false)}
              onClick={event => { if (!event.detail || !pointer.moved.current) onSquare?.(square); }}
              className={(row + column) % 2 === 0 ? styles.light : styles.dark}>
              {piece && <div role="img" aria-label={`${piece.color} ${piece.type} ${square}`}
                data-sprite={piece.color[0] + (piece.type === "knight" ? "N" : piece.type[0].toUpperCase())}
                style={dragging ? { transform: `translate(${dragging.x}px, ${dragging.y}px)` } : offset}
                className={[dragging ? styles.dragging : animate ? styles.arriving : "", pieces.piece, pieces[piece.color], pieces[piece.type]].join(" ")} />}
            </button>
          );
        }))}
      </div>
      <div className={styles.ranks}>{visibleRanks.map(rank => <span key={rank}>{rank}</span>)}</div>
      <div className={styles.files}>{visibleFiles.map(file => <span key={file}>{file.toUpperCase()}</span>)}</div>
    </div>
  );
}
