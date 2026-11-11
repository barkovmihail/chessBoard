import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import { resultReason } from "../../features/play";
import { BoardLayout } from "../../shared/board-layout";

interface View {
  board: Chess; lastUci?: string; notation: string[]; result: string | null; reason: string | null; waiting: boolean;
}

export function WatchPage({ token }: { token: string }) {
  const { language, t } = useLanguage();
  const [view, setView] = useState<View>();
  const [error, setError] = useState<"unavailable" | "offline" | null>(null);
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
          setView(undefined); setError("unavailable"); return;
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
        setError(null);
      } catch {
        if (abort.signal.aborted) return;
        setError("offline");
      }
      timer = setTimeout(refresh, 1500);
    }
    void refresh();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [token]);
  const message = error === "unavailable" ? t("Просмотр этой партии недоступен.", "Spectator access is unavailable.", "Esta partida no está disponible para espectadores.") :
    error === "offline" ? t("Восстанавливаем связь…", "Reconnecting…", "Reconectando…") : "";
  if (!view) return <main><h1>{t("Просмотр партии", "Watch game", "Ver partida")}</h1><p role="status">{message || t("Загружаем позицию…", "Loading position…", "Cargando la posición…")}</p></main>;
  const history = view.board.history({ verbose: true });
  return <BoardLayout context={<h1>{t("Просмотр партии", "Watch game", "Ver partida")}</h1>} board={<Board position={boardPosition(view.board)} lastMove={history[history.length - 1]} highlight={view.lastUci} />}
    status={<p role="status">{message || (view.result ? view.result + " · " + resultReason(view.reason ?? "", language) :
      view.waiting ? t("Ожидание соперника", "Waiting for opponent", "Esperando al rival") : view.board.turn() === "w" ? t("Ход белых", "White to move", "Juegan blancas") : t("Ход чёрных", "Black to move", "Juegan negras"))}</p>}
    actions={<p aria-label={t("Запись ходов", "Move list", "Lista de jugadas")}>{view.notation.map((m, i) => (i % 2 === 0 ? (i / 2 + 1) + ". " : "") + m).join(" ")}</p>} />;
}
