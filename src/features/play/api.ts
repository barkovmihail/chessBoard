import type { BoardPiece } from "../../entities/board";

export interface Game {
  id: string;
  version: number;
  position: BoardPiece[];
  turn: "white" | "black";
  moves: string[];
  legal: string[];
  result: string | null;
  side: "white" | "black" | "both";
  waiting: boolean;
}

export class RequestError extends Error {}

export async function requestGame(path: string, body?: object): Promise<Game> {
  const response = await fetch("/api/games" + path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new RequestError(String(data.detail));
  if (!["white", "black", "both"].includes(data.side) || typeof data.waiting !== "boolean" ||
      typeof data.id !== "string" || !Number.isInteger(data.version) ||
      !["white", "black"].includes(data.turn) || !Array.isArray(data.position) ||
      !data.position.every((p: BoardPiece) => p && /^[a-h][1-8]$/.test(p.square) &&
        ["white", "black"].includes(p.color) && ["king","queen","rook","bishop","knight","pawn"].includes(p.type)) ||
      ![data.legal, data.moves].every(list => Array.isArray(list) && list.every(value => typeof value === "string")) ||
      !(data.result === null || typeof data.result === "string")) throw new Error("invalid_snapshot");
  return data;
}
