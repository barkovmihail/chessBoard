import type { Game } from "../../features/play";
import type { PositionScore } from "./GameReport";

// Change the version when the scoring method or the stored representation changes.
export function reportKey(game: Game) {
  return ["chessboard.review", "v1", game.id, game.engine_name ?? "lc0"].join(".");
}

function validScore(score: PositionScore | null) {
  return !!score && Number.isFinite(score.value) && typeof score.label === "string" &&
    (score.best === undefined || typeof score.best === "string") &&
    (score.bestUci === undefined || /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(score.bestUci)) &&
    (score.legalCount === undefined || Number.isSafeInteger(score.legalCount)) &&
    (score.alternativeGap === undefined || Number.isFinite(score.alternativeGap));
}

export function readScores(key: string, total: number): PositionScore[] {
  try {
    const scores = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (Array.isArray(scores) && scores.length <= total + 1 && scores.every(validScore)) return scores;
  } catch { /* Analysis also works when browser storage is unavailable. */ }
  return [];
}

export function readReviewPly(key: string, total: number) {
  try {
    const value = localStorage.getItem(key + ".ply");
    if (value !== null && /^\d+$/.test(value) && Number(value) <= total) return Number(value);
  } catch { /* Open at the final position when storage is unavailable. */ }
  return total;
}

export function saveReviewPly(key: string, ply: number) {
  try { localStorage.setItem(key + ".ply", String(ply)); } catch { /* Session-only selection. */ }
}

export function saveScores(key: string, scores: PositionScore[], total: number) {
  try {
    if (scores.length > readScores(key, total).length) localStorage.setItem(key, JSON.stringify(scores));
  } catch { /* Keep calculated positions available in memory. */ }
}
