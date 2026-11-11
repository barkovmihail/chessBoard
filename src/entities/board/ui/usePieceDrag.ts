import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Square } from "../model/position";

interface Origin {
  square: Square;
  pointer: number;
  x: number;
  y: number;
}

export function usePieceDrag(onDrop?: (from: Square, to: Square) => void) {
  const origin = useRef<Origin>();
  const moved = useRef(false);
  const [drag, setDrag] = useState<{ square: Square; x: number; y: number }>();

  function start(event: PointerEvent<HTMLButtonElement>, square: Square, movable: boolean) {
    if (!event.isPrimary || event.button !== 0) return;
    moved.current = false;
    if (!movable || !onDrop) return;
    origin.current = { square, pointer: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const start = origin.current;
    if (!start || start.pointer !== event.pointerId) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (!moved.current && Math.hypot(x, y) < 5) return;
    moved.current = true;
    setDrag({ square: start.square, x, y });
  }

  function end(event: PointerEvent<HTMLButtonElement>, drop: boolean) {
    const start = origin.current;
    if (!start || start.pointer !== event.pointerId) return;
    origin.current = undefined;
    setDrag(undefined);
    if (drop && moved.current) {
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("button[data-square]");
      if (cell && cell.parentElement === event.currentTarget.parentElement && !cell.disabled) {
        const to = cell.dataset.square as Square;
        if (to !== start.square) onDrop?.(start.square, to);
      }
    }
  }

  return { drag, moved, start, move, end };
}
