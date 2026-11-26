import { Chess } from "chess.js";

export interface Puzzle {
  id: string;
  rating: number;
  fen: string;
  side: "w" | "b";
  steps: [string, string][];
}

export async function loadPuzzle(signal: AbortSignal, id?: string, theme = ""): Promise<Puzzle> {
  const url = id ? "/api/puzzles/by-id/" + encodeURIComponent(id) : "/api/puzzles/random" + (theme ? "?theme=" + encodeURIComponent(theme) : "");
  const response = await fetch(url, { signal, cache: "no-store" });
  if (response.status === 404) throw new Error(id ? "missing" : "empty-theme");
  if (!response.ok) throw new Error("unavailable");
  const data = await response.json();
  const board = new Chess(data.fen);
  board.move(data.moves[0]);
  const fen = board.fen();
  const side = board.turn();
  const steps: [string, string][] = data.moves.slice(1).map((uci: string) => [board.move(uci).san, ""]);
  if (!steps.length) throw new Error("empty");
  return { id: data.puzzle_id, rating: data.rating, fen, side, steps };
}
