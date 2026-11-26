import React, { useId, useRef, useState } from "react";
import { useLanguage } from "../../../shared/language";
import { files, ranks } from "../model/position";
import type { BoardPiece, Square } from "../model/position";
import styles from "./board.module.css";
import { usePieceDrag } from "./usePieceDrag";
import pieces from "./pieces.module.css";

const pieceNames: Record<BoardPiece["color"], Record<BoardPiece["type"], [string, string, string]>> = {
  white: {
    pawn: ["белая пешка", "white pawn", "peón blanco"],
    knight: ["белый конь", "white knight", "caballo blanco"],
    bishop: ["белый слон", "white bishop", "alfil blanco"],
    rook: ["белая ладья", "white rook", "torre blanca"],
    queen: ["белый ферзь", "white queen", "dama blanca"],
    king: ["белый король", "white king", "rey blanco"],
  },
  black: {
    pawn: ["чёрная пешка", "black pawn", "peón negro"],
    knight: ["чёрный конь", "black knight", "caballo negro"],
    bishop: ["чёрный слон", "black bishop", "alfil negro"],
    rook: ["чёрная ладья", "black rook", "torre negra"],
    queen: ["чёрный ферзь", "black queen", "dama negra"],
    king: ["чёрный король", "black king", "rey negro"],
  },
};

interface BoardProps {
  position: readonly BoardPiece[];
  arrows?: readonly { uci: string; mistake: boolean }[];
  selected?: Square;
  flipped?: boolean;
  lastMove?: { from: Square; to: Square };
  highlight?: string;
  targets?: readonly string[];
  onMove?: (from: Square, to: Square) => void;
  inspectable?: boolean;
  movableColor?: BoardPiece["color"] | "white" | "black";
  onSquare?: (square: Square) => void;
}

export function Board({ position, arrows, selected, targets, onSquare, flipped, lastMove, highlight, onMove, movableColor, inspectable }: BoardProps) {
  const { t } = useLanguage();
  const pointer = usePieceDrag(onMove);
  const grid = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const [cursor, setCursor] = useState<Square>();
  const squares = highlight ?? (lastMove && lastMove.from + lastMove.to);
  const occupied = new Map(position.map(piece => [piece.square, piece]));
  const visibleFiles = flipped ? [...files].reverse() : files;
  const visibleRanks = flipped ? [...ranks].reverse() : ranks;
  const entrySquare = cursor ?? `${visibleFiles[0]}${visibleRanks[0]}`;
  const canNavigate = !!(onSquare || movableColor || inspectable);
  function navigate(event: React.KeyboardEvent, row: number, column: number) {
    switch (event.key) {
      case "ArrowUp": row--; break;
      case "ArrowDown": row++; break;
      case "ArrowLeft": column--; break;
      case "ArrowRight": column++; break;
      case "Home": column = 0; if (event.ctrlKey) row = 0; break;
      case "End": column = 7; if (event.ctrlKey) row = 7; break;
      default: return;
    }
    event.preventDefault();
    const file = visibleFiles[column], rank = visibleRanks[row];
    if (file && rank) grid.current?.querySelector<HTMLButtonElement>(`[data-square="${file}${rank}"]`)?.focus();
  }
  return (
    <div className={styles.board}>
      {canNavigate && <span id={helpId} className={styles.keyboardHelp}>{onSquare
        ? t("Стрелки перемещают фокус. Нажмите Enter или пробел на фигуре, затем на поле назначения.", "Use the arrow keys to move focus. Press Enter or Space on a piece and then on its destination.", "Usa las flechas para moverte. Pulsa Intro o espacio en una pieza y después en la casilla de destino.")
        : t("Используйте стрелки для просмотра позиции.", "Use the arrow keys to inspect the position.", "Usa las flechas para explorar la posición.")}</span>}
      <div ref={grid} className={styles.cells} role="grid" aria-label={t("Шахматная доска", "Chessboard", "Tablero de ajedrez")} aria-describedby={canNavigate ? helpId : undefined} aria-readonly={!onSquare}>
        {visibleRanks.map((rank, row) => <div key={rank} role="row" className={styles.row}>{visibleFiles.map((file, column) => {
          const square: Square = `${file}${rank}`;
          const piece = occupied.get(square);
          const contents = piece ? t(...pieceNames[piece.color][piece.type]) : t("пусто", "empty", "vacía");
          const dragging = pointer.drag?.square === square ? pointer.drag : undefined;
          const movable = !!piece && piece.color === movableColor && !!onMove;
          const animate = piece && lastMove?.to === square;
          const offset = animate && lastMove ? {
            "--from-x": (visibleFiles.indexOf(lastMove.from[0] as typeof files[number]) - column) * 100 + "%",
            "--from-y": (visibleRanks.indexOf(Number(lastMove.from[1]) as typeof ranks[number]) - row) * 100 + "%",
          } as React.CSSProperties : undefined;
          return (
            <div key={square} role="gridcell"><button type="button" data-square={square} aria-label={square + ", " + contents}
              disabled={!canNavigate} tabIndex={canNavigate && square === entrySquare ? 0 : -1} onFocus={() => setCursor(square)} onKeyDown={event => navigate(event, row, column)}
              aria-disabled={!onSquare || undefined} aria-pressed={onSquare ? selected === square : undefined} data-target={targets?.includes(square)}
              data-last-move={squares && (square === squares.slice(0, 2) || square === squares.slice(2, 4)) || undefined}
              data-movable={movable}
              onPointerDown={event => pointer.start(event, square, movable)}
              onPointerMove={pointer.move} onPointerUp={event => pointer.end(event, true)}
              onPointerCancel={event => pointer.end(event, false)} onLostPointerCapture={event => pointer.end(event, false)}
              onClick={event => { if (!event.detail || !pointer.moved.current) onSquare?.(square); }}
              className={(row + column) % 2 === 0 ? styles.light : styles.dark}>
              {piece && <div aria-hidden="true"
                data-sprite={piece.color[0] + (piece.type === "knight" ? "N" : piece.type[0].toUpperCase())}
                style={dragging ? { transform: `translate(${dragging.x}px, ${dragging.y}px)` } : offset}
                className={[dragging ? styles.dragging : animate ? styles.arriving : "", pieces.piece, pieces[piece.color], pieces[piece.type]].join(" ")} />}
            </button></div>
          );
        })}</div>)}
      </div>
      {arrows?.length ? <svg className={styles.arrows} viewBox="0 0 8 8" aria-hidden="true">
        {arrows.map(({ uci, mistake }) => {
          const x = (file: string) => visibleFiles.indexOf(file as typeof files[number]) + 0.5;
          const y = (rank: string) => visibleRanks.indexOf(Number(rank) as typeof ranks[number]) + 0.5;
          const dx = x(uci[2]) - x(uci[0]), dy = y(uci[3]) - y(uci[1]);
          const length = Math.hypot(dx, dy);
          return <g key={uci} data-arrow={mistake ? "mistake" : "recommended"} data-uci={uci}
            transform={`translate(${x(uci[0])} ${y(uci[1])}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}
            color={mistake ? "#ad2936" : "#137443"}>
            <line x1=".16" x2={length - .24} stroke="currentColor" strokeWidth=".105" strokeDasharray={mistake ? ".18 .09" : undefined} />
            <path d={`M ${length} 0 l -.32 -.19 v .38 Z`} fill="currentColor" stroke="white" strokeWidth=".025" />
          </g>;
        })}
      </svg> : null}
      <div className={styles.ranks}>{visibleRanks.map(rank => <span key={rank}>{rank}</span>)}</div>
      <div className={styles.files}>{visibleFiles.map(file => <span key={file}>{file.toUpperCase()}</span>)}</div>
    </div>
  );
}
