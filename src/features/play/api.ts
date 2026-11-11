import type { BoardPiece } from "../../entities/board";

export interface Game {
  id: string;
  version: number;
  position: BoardPiece[];
  turn: "white" | "black";
  moves: string[];
  legal: string[];
  result: string | null;
  reason: string | null;
  claims?: Record<string, string>;
  previous_game?: string | null;
  next_game?: string | null;
  rematch_offer?: "white" | "black" | null;
  rated?: boolean;
  draw_offer: "white" | "black" | null;
  side: "white" | "black" | "both";
  waiting: boolean;
  clock?: { base_minutes: number; increment_seconds: number; white_ms: number; black_ms: number;
    deadline_ms: number | null; server_ms: number; received_ms: number };
}

export class RequestError extends Error {}

export async function requestGame(path: string, body?: object): Promise<Game> {
  const response = await fetch("/api/games" + path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new RequestError(String(data.detail));
  return parseGame(data);
}

function parseGame(data: any): Game {
  if (!data || ![null, "white", "black"].includes(data.draw_offer) ||
      !(data.reason === null || typeof data.reason === "string") || !["white", "black", "both"].includes(data.side) || typeof data.waiting !== "boolean" ||
      typeof data.id !== "string" || !Number.isInteger(data.version) ||
      !["white", "black"].includes(data.turn) || !Array.isArray(data.position) ||
      !data.position.every((p: BoardPiece) => p && /^[a-h][1-8]$/.test(p.square) &&
        ["white", "black"].includes(p.color) && ["king","queen","rook","bishop","knight","pawn"].includes(p.type)) ||
      ![data.legal, data.moves].every(list => Array.isArray(list) && list.every(value => typeof value === "string")) ||
      !(data.result === null || typeof data.result === "string")) throw new Error("invalid_snapshot");
  if (![data.previous_game, data.next_game].every(id => id == null || (typeof id === "string" && /^[a-f0-9]{32}$/.test(id))) ||
      ![undefined, null, "white", "black"].includes(data.rematch_offer)) throw new Error("invalid_rematch");
  if (data.claims !== undefined && (!data.claims || typeof data.claims !== "object" || Array.isArray(data.claims) ||
      !Object.entries(data.claims).every(([key, value]) => /^claim(:[a-h][1-8][a-h][1-8][qrbn]?)?$/.test(key) &&
        (value === "threefold_repetition" || value === "fifty_moves")))) throw new Error("invalid_claims");
  if (data.clock) {
    const c = data.clock;
    if (![c.base_minutes, c.increment_seconds, c.white_ms, c.black_ms, c.server_ms].every(Number.isSafeInteger)
        || !(c.deadline_ms === null || Number.isSafeInteger(c.deadline_ms))) throw new Error("invalid_clock");
    c.received_ms = performance.now();
  }
  return data;
}

export function subscribeGame(id: string, update: (game: Game) => void, connection: (lost: boolean) => void) {
  const address = new URL("/api/games/" + encodeURIComponent(id) + "/events", location.href);
  address.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  let active = true;
  let socket: WebSocket;
  let retry: ReturnType<typeof setTimeout>;
  function connect() {
    socket = new WebSocket(address);
    socket.onmessage = event => {
      if (!active) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type !== "snapshot") throw new Error("invalid_event");
        const game = parseGame(message.game);
        if (game.id !== id) throw new Error("invalid_game");
        connection(false);
        update(game);
      } catch { socket.close(); }
    };
    socket.onclose = () => {
      if (!active) return;
      connection(true);
      retry = setTimeout(connect, 1000);
    };
  }
  connect();
  return () => {
    active = false;
    clearTimeout(retry);
    socket.close();
  };
}
