import styles from "./game.module.css";
import { readReviewPly, readScores, reportKey, saveReviewPly, saveScores } from "./savedReport";
import { classifyMove, qualityLabels } from "./moveQuality";
import { ReplayButtons } from "../../shared/replay";
import { useLanguage } from "../../shared/language";
import React, { useEffect, useMemo, useState } from "react";
import { ReviewPractice } from "./ReviewPractice";
import { EvaluationChart } from "./EvaluationChart";
import { MoveTimes } from "./MoveTimes";
import { GameReport, type PositionScore } from "./GameReport";
import { EngineAnalysis } from "./EngineAnalysis";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import type { Game } from "../../features/play";

export function GameReview({ game, summary, render }: {
  game: Game; summary: React.ReactNode; render: (board: React.ReactElement, controls: React.ReactElement, belowBoard: React.ReactElement) => React.ReactElement;
}) {
  const { language, t } = useLanguage();
  const key = reportKey(game);
  const [movesOnly, setMovesOnly] = useState(false);
  const [practice, setPractice] = useState(false);
  const [timeView, setTimeView] = useState(false);
  const [scores, setScores] = useState<PositionScore[]>(() => readScores(key, game.moves.length));
  const [ply, setPly] = useState(() => scores.length ? readReviewPly(key, game.moves.length) : game.moves.length);
  useEffect(() => {
    if (scores.length) saveScores(key, scores, game.moves.length);
  }, [key, scores, game.moves.length]);
  useEffect(() => {
    if (scores.length) saveReviewPly(key, ply);
  }, [key, ply, scores.length]);
  const [showArrows, setShowArrows] = useState(true);
  const before = scores[ply - 1], after = scores[ply];
  const best = before?.bestUci;
  const comparing = !timeView && showArrows && !!best && !!after;
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
  const mistake = !!played && classifyMove(before, after, ply, game.moves[ply - 1]) === "mistake";
  const arrows = comparing ? [...(mistake ? [{ uci: played!, mistake: true }] : []), { uci: best, mistake: false }] : [];
  if (practice && best) return <ReviewPractice id={game.id} ply={ply} best={best} exit={() => setPractice(false)} />;
  return render(<Board inspectable arrows={arrows} position={position} flipped={game.side === "black"} lastMove={comparing ? undefined : lastMove} highlight={comparing ? undefined : game.review960?.uci?.[ply - 1]} />, <>
    <div className={styles.switches}>
      <button aria-pressed={!movesOnly} onClick={() => setMovesOnly(false)}>{t("Обзор", "Overview", "Resumen")}</button>
      <button aria-pressed={movesOnly} onClick={() => setMovesOnly(true)}>{t("Ходы", "Moves", "Jugadas")}</button>
    </div>
    <div><div className={styles.historyHead} aria-hidden="true"><span>{t("Ход", "Move", "Jugada")}</span><span>{t("Белые", "White", "Blancas")}</span><span>{t("Чёрные", "Black", "Negras")}</span></div>
    <ol className={styles.reviewScore + " review-score"} aria-label={t("Запись ходов", "Move list", "Lista de jugadas")}>{game.moves.map((_, i) => i % 2 === 0 &&
      <li key={i}><small>{i / 2 + 1}.</small>{" "}{game.moves.slice(i, i + 2).map((move, offset) => {
        const index = i + offset;
        const quality = classifyMove(scores[index], scores[index + 1], index + 1, move);
        const label = quality && qualityLabels[quality];
        return <React.Fragment key={offset}>{offset > 0 && " "}<button aria-current={ply === i + offset + 1 ? "step" : undefined}
          onClick={() => setPly(i + offset + 1)}>{move}{label && <small className="move-quality" data-quality={quality}>{t(label[0], label[1], label[2])}</small>}</button></React.Fragment>;
      })}</li>)}</ol>
    </div>
    {!movesOnly && <div className={styles.reviewResult}>{summary}</div>}
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
      {!timeView && mistake && best && <button onClick={() => setPractice(true)}>{t("Повторить ошибку", "Retry mistake", "Reintentar el error")}</button>}
      {!timeView && best && after && <label><input type="checkbox" checked={showArrows} onChange={e => setShowArrows(e.target.checked)} />
        {t("Сравнить стрелками из позиции до хода", "Compare arrows from the position before the move", "Comparar con flechas desde la posición anterior")}</label>}
      {comparing && <p>{t("Сплошная — рекомендация движка", "Solid arrow — engine recommendation", "Flecha continua — recomendación del motor")} · {before.best}
        {mistake && <> · {t("Пунктир — сыгранная ошибка", "Dashed arrow — played mistake", "Flecha discontinua — error jugado")} · {game.moves[ply - 1]}</>}</p>}
    </nav>
    <div className={styles.reviewTools} hidden={timeView || movesOnly}><GameReport scores={scores} setScores={setScores} game={game} ply={ply} select={setPly} practise={i => { setPly(i); setPractice(true); }} />
    <EngineAnalysis id={game.id} ply={ply} initial={game.engine_name ?? "lc0"} /></div>
    <a href={"data:application/x-chess-pgn;charset=utf-8," + encodeURIComponent(pgn)}
      download={game.id + ".pgn"}>{t("Скачать PGN", "Download PGN", "Descargar PGN")}</a>
    {game.chess960 == null && <a href={"?section=analysis&game=" + game.id + "&ply=" + (comparing ? ply - 1 : ply)}>{t("Разобрать позицию", "Analyze position", "Analizar la posición")}</a>}
  </>, <section>
    <div className="replay-buttons">
      <button aria-pressed={!timeView} onClick={() => setTimeView(false)}>{t("Разбор", "Review", "Revisión")}</button>
      <button aria-pressed={timeView} onClick={() => setTimeView(true)}>{t("Время", "Time", "Tiempo")}</button>
    </div>
    {timeView ? <MoveTimes game={game} ply={ply} select={setPly} /> :
      <EvaluationChart moves={game.moves} scores={scores} ply={ply} select={setPly} />}
  </section>);
}
