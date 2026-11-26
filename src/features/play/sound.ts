import type { Cue } from "../../shared/sound";
import type { Game } from "./api";

export function gameCue(previous: Game, next: Game): Cue | undefined {
  if (previous.id !== next.id || previous.result) return;
  if (next.result) return "finish";
  if (previous.waiting && !next.waiting) return "start";
  if (next.moves.length !== previous.moves.length + 1) return;
  const san = next.moves[next.moves.length - 1];
  if (san.endsWith("+")) return "check";
  if (san.includes("=")) return "promotion";
  if (san.startsWith("O-O")) return "castle";
  if (san.includes("x")) return "capture";
  return "move";
}
