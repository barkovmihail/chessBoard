import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import { reasons } from "../../features/play";
import { BoardLayout } from "../../shared/board-layout";

interface View {
  board: Chess; lastUci?: string; notation: string[]; result: string | null; reason: string | null; waiting: boolean;
}

export function WatchPage({ token }: { token: string }) {
  const [view, setView] = useState<View>();
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let version: number | undefined;
    async function refresh() {
      try {
        const response = await fetch("/api/watch/" + encodeURIComponent(token) + (version === undefined ? "" : "?version=" + version),
          { signal: abort.signal, cache: "no-store" });
        if (abort.signal.aborted) return;
        if ([404, 422].includes(response.status)) {
          setView(undefined); setError("Просмотр этой партии недоступен."); return;
        }
        if (!response.ok) throw Error();
        if (response.status !== 204) {
          const data = await response.json();
          if (!Number.isSafeInteger(data.version) || !Array.isArray(data.moves) || typeof data.waiting !== "boolean" ||
              !(data.result === null || ["1-0", "0-1", "1/2-1/2"].includes(data.result)) ||
              !(data.reason === null || typeof data.reason === "string")) throw Error();
          const board = new Chess(data.fen);
          if (!data.fen) for (const uci of data.moves) board.move(uci);
          const notation = data.fen ? data.notation : board.history();
          if (!Array.isArray(notation) || !notation.every(m => typeof m === "string")) throw Error();
          if (abort.signal.aborted) return;
          setView({ board, lastUci: data.moves[data.moves.length - 1], notation, result: data.result, reason: data.reason, waiting: data.waiting });
          version = data.waiting ? undefined : data.version;
        }
        setError("");
      } catch {
        if (abort.signal.aborted) return;
        setError("Восстанавливаем связь…");
      }
      timer = setTimeout(refresh, 1500);
    }
    void refresh();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [token]);
  if (!view) return <main><h1>Просмотр партии</h1><p role="status">{error || "Загружаем позицию…"}</p></main>;
  const history = view.board.history({ verbose: true });
  return <BoardLayout context={<h1>Просмотр партии</h1>} board={<Board position={boardPosition(view.board)} lastMove={history[history.length - 1]} highlight={view.lastUci} />}
    status={<p role="status">{error || (view.result ? view.result + " · " + (reasons[view.reason ?? ""] ?? "") :
      view.waiting ? "Ожидание соперника" : view.board.turn() === "w" ? "Ход белых" : "Ход чёрных")}</p>}
    actions={<p aria-label="Запись ходов">{view.notation.map((m, i) => (i % 2 === 0 ? (i / 2 + 1) + ". " : "") + m).join(" ")}</p>} />;
}
