import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { PlayBoard } from "../../features/play";
import { boardPosition } from "../../entities/board";
import { BoardLayout } from "../../shared/board-layout";
import { useLanguage } from "../../shared/language";

export function ReviewPractice({ id, ply, best, exit }: {
  id: string; ply: number; best: string; exit: () => void;
}) {
  const { language, t } = useLanguage();
  const [moves, setMoves] = useState<string[]>([]);
  const [view, setView] = useState<{ board: Chess; legal: string[]; san: string[] }>();
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      const response = await fetch("/api/games/" + id + "/practice", { method: "POST", signal: abort.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ply, moves }) });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (typeof data.fen !== "string" || !Array.isArray(data.moves) || data.moves.length !== moves.length ||
        !data.moves.every((s: unknown) => typeof s === "string") || !Array.isArray(data.legal) ||
        !data.legal.every((s: unknown) => typeof s === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s))) throw Error();
      const board = new Chess(data.fen);
      if (!abort.signal.aborted) setView({ board, legal: data.legal, san: data.moves });
    }
    setBusy(true); setFailed(false);
    load().catch(() => { if (!abort.signal.aborted) setFailed(true); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [id, ply, moves, retry]);
  return <BoardLayout gameWorkspace lang={language} title={t("Найдите улучшение", "Find an improvement", "Encuentra una mejora")}
    board={view && <PlayBoard positionKey={view.board.fen()} enabled={!busy && !failed && moves.length < 256}
      game={{ position: boardPosition(view.board), turn: view.board.turn() === "w" ? "white" : "black",
        side: ply % 2 ? "white" : "black", legal: view.legal }}
      onMove={uci => { setBusy(true); setMoves([...moves, uci]); }} />}
    actions={<>
      {busy && <p role="status">{t("Загрузка позиции…", "Loading position…", "Cargando la posición…")}</p>}
      {failed && <button onClick={() => setRetry(retry + 1)}>{t("Повторить загрузку", "Retry loading", "Volver a cargar")}</button>}
      {!busy && !failed && view && moves.length > 0 && <><p aria-live="polite">{moves[0] === best ?
        t("Вы нашли ход движка.", "You found the engine move.", "Has encontrado la jugada del motor.") :
        t("Движок выбрал другой ход.", "The engine chose another move.", "El motor eligió otra jugada.")}</p>
        <p>{view.san.join(" ")}</p></>}
      {hint ? <p>{t("Подсказка", "Hint", "Pista")} · {best.slice(0, 2)} → {best.slice(2, 4)} {best.slice(4)}</p> :
        <button onClick={() => setHint(true)}>{t("Показать подсказку", "Show hint", "Mostrar pista")}</button>}
      {moves.length > 0 && <button onClick={() => { setMoves([]); setHint(false); }}>{t("Начать заново", "Restart", "Volver a empezar")}</button>}
      <button onClick={exit}>{t("Вернуться к разбору", "Return to review", "Volver a la revisión")}</button>
    </>} />;
}
