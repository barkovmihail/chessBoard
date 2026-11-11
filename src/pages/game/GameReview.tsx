import { ReplayButtons } from "../../shared/replay";
import { useLanguage } from "../../shared/language";
import React, { useMemo, useState } from "react";
import { GameReport, type PositionScore } from "./GameReport";
import { EngineAnalysis } from "./EngineAnalysis";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import type { Game } from "../../features/play";

export function GameReview({ game, render }: {
  game: Game; render: (board: React.ReactElement, controls: React.ReactElement) => React.ReactElement;
}) {
  const { language, t } = useLanguage();
  const [ply, setPly] = useState(game.moves.length);
  const [scores, setScores] = useState<PositionScore[]>([]);
  const [showArrows, setShowArrows] = useState(true);
  const before = scores[ply - 1], after = scores[ply];
  const best = before?.bestUci;
  const comparing = showArrows && !!best && !!after;
  const { position, lastMove } = useMemo(() => {
    if (game.review960) return { position: boardPosition(new Chess(game.review960.fens[comparing ? ply - 1 : ply])), lastMove: undefined };
    const board = new Chess();
    let lastMove;
    for (const san of game.moves.slice(0, ply)) lastMove = board.move(san);
    if (comparing) board.undo();
    return { position: boardPosition(board), lastMove };
  }, [game.moves, game.review960, ply, comparing]);
  const pgn = useMemo(() => {
    if (game.review960) return game.review960.pgn;
    const board = new Chess();
    game.moves.forEach(move => board.move(move));
    board.setHeader("Result", game.result ?? "*");
    if (game.clock) board.setHeader("TimeControl", game.clock.base_minutes * 60 + "+" + game.clock.increment_seconds);
    return board.pgn();
  }, [game]);
  const played = game.review960?.uci?.[ply - 1] ?? lastMove?.lan;
  const loss = before && after ? (before.value - after.value) * (ply % 2 ? 1 : -1) : 0;
  const mistake = !!played && played !== best && loss >= 100;
  const arrows = comparing ? [...(mistake ? [{ uci: played!, mistake: true }] : []), { uci: best, mistake: false }] : [];
  return render(<Board arrows={arrows} position={position} flipped={game.side === "black"} lastMove={comparing ? undefined : lastMove} highlight={comparing ? undefined : game.review960?.uci?.[ply - 1]} />, <>
    <nav lang={language} aria-label={t("Просмотр партии", "Game replay", "Reproducción de la partida")}>
      <ReplayButtons ply={ply} total={game.moves.length} onSelect={setPly} />
      <p aria-live="polite">{ply ? Math.ceil(ply / 2) + (ply % 2 ? ". " : "… ") + game.moves[ply - 1] : t("Начальная позиция", "Starting position", "Posición inicial")}</p>
      {lastMove && <p>{{
        p: t("Пешка", "Pawn", "Peón"), n: t("Конь", "Knight", "Caballo"), b: t("Слон", "Bishop", "Alfil"),
        r: t("Ладья", "Rook", "Torre"), q: t("Ферзь", "Queen", "Dama"), k: t("Король", "King", "Rey"),
      }[lastMove.piece]} · {lastMove.from} → {lastMove.to}
        {lastMove.captured && t(" · взятие", " · capture", " · captura")}
        {lastMove.san.startsWith("O-O") && t(" · рокировка", " · castling", " · enroque")}
        {lastMove.san.endsWith("#") ? t(" · мат", " · checkmate", " · jaque mate") : lastMove.san.endsWith("+") && t(" · шах", " · check", " · jaque")}
      </p>}
      {best && after && <label><input type="checkbox" checked={showArrows} onChange={e => setShowArrows(e.target.checked)} />
        {t("Сравнить стрелками из позиции до хода", "Compare arrows from the position before the move", "Comparar con flechas desde la posición anterior")}</label>}
      {comparing && <p>{t("Сплошная — рекомендация движка", "Solid arrow — engine recommendation", "Flecha continua — recomendación del motor")} · {before.best}
        {mistake && <> · {t("Пунктир — сыгранная ошибка", "Dashed arrow — played mistake", "Flecha discontinua — error jugado")} · {game.moves[ply - 1]}</>}</p>}
    </nav>
    <ol className="review-score" aria-label={t("Запись ходов", "Move list", "Lista de jugadas")}>{game.moves.map((_, i) => i % 2 === 0 &&
      <li key={i}>{game.moves.slice(i, i + 2).map((move, offset) =>
        <React.Fragment key={offset}>{offset > 0 && " "}<button aria-current={ply === i + offset + 1 ? "step" : undefined}
          onClick={() => setPly(i + offset + 1)}>{move}</button></React.Fragment>)}</li>)}</ol>
    <GameReport scores={scores} setScores={setScores} game={game} ply={ply} select={setPly} />
    <EngineAnalysis id={game.id} ply={ply} initial={game.engine_name ?? "lc0"} />
    <a href={"data:application/x-chess-pgn;charset=utf-8," + encodeURIComponent(pgn)}
      download={game.id + ".pgn"}>{t("Скачать PGN", "Download PGN", "Descargar PGN")}</a>
    {game.chess960 == null && <a href={"?section=analysis&game=" + game.id + "&ply=" + (comparing ? ply - 1 : ply)}>{t("Разобрать позицию", "Analyze position", "Analizar la posición")}</a>}
  </>);
}
