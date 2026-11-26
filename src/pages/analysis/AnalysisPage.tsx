import { ReplayButtons } from "../../shared/replay";
import { useLanguage } from "../../shared/language";
import React, { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import { BoardLayout, BoardSeat } from "../../shared/board-layout";
import { panelStyles } from "../../shared/page-panels";
import styles from "./analysis.module.css";
import { PlayBoard, requestGame } from "../../features/play";

interface Line {
  moves: string[];
  result: string;
  fen?: string;
}

function readNotation(text: string, format: "PGN" | "FEN") {
  if (!text.trim()) throw new Error("empty notation");
  if (format === "FEN") return new Chess(text.trim());
  const chess = new Chess();
  chess.loadPgn(text);
  return chess;
}

function MoveTable({ line, ply, onSelect }: { line: Line; ply: number; onSelect: (index: number) => void }) {
  const { t } = useLanguage();
  const fen = line.fen?.split(" ");
  const offset = fen?.[1] === "b" ? 1 : 0;
  const firstNumber = Number(fen?.[5] ?? 1);
  const rowCount = Math.ceil((line.moves.length + offset) / 2);
  return <div className={styles.moveTable}><table>
    <thead><tr><th scope="col">{t("Ход", "Move", "Jugada")}</th><th scope="col">{t("Белые", "White", "Blancas")}</th><th scope="col">{t("Чёрные", "Black", "Negras")}</th></tr></thead>
    <tbody>{line.moves.length === 0 ? <tr><td colSpan={3}>{t("Исходная позиция", "Starting position", "Posición inicial")}</td></tr> :
      Array.from({ length: rowCount }, (_, row) => <tr key={row}><th scope="row">{firstNumber + row}.</th>
        {[0, 1].map(side => {
          const index = 2 * row + side - offset;
          const move = line.moves[index];
          return <td key={side}>{move && <button className="notation-move" aria-current={ply === index + 1 ? "step" : undefined}
            onClick={() => onSelect(index + 1)}>{move}</button>}</td>;
        })}</tr>)}</tbody>
  </table></div>;
}

export function AnalysisPage() {
  const { language, t } = useLanguage();
  const query = new URLSearchParams(location.search);
  const id = query.get("game");
  const requestedPly = Number(query.get("ply") ?? Infinity);
  const [line, setLine] = useState<Line>({ moves: [], result: "*" });
  const [ply, setPly] = useState(0);
  const [variation, setVariation] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<"game" | "file" | "PGN" | "FEN" | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [side, setSide] = useState<"white" | "black" | "both">("white");
  const [importPage, setImportPage] = useState(() => location.hash === "#import");
  const [showPosition, setShowPosition] = useState(false);
  const [preview, setPreview] = useState<Chess>();

  useEffect(() => {
    if (!importPage) return;
    const timer = setTimeout(() => {
      try {
        const format = /^[prnbqkPRNBQK1-8]+\//.test(input.trim()) ? "FEN" : "PGN";
        setPreview(readNotation(input, format));
      } catch { setPreview(undefined); }
    }, 250);
    return () => clearTimeout(timer);
  }, [input, importPage]);

  useEffect(() => {
    const change = () => setImportPage(location.hash === "#import");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    requestGame("/" + encodeURIComponent(id)).then(game => {
      if (!active) return;
      if (!game.result || game.chess960 != null) throw Error();
      setLine({ moves: game.moves, result: game.result });
      setPly(Number.isInteger(requestedPly) ? Math.max(0, Math.min(requestedPly, game.moves.length)) : game.moves.length);
      setSide(game.side);
    }).catch(() => { if (active) setError("game"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, requestedPly]);

  const { board, lastMove, legal } = useMemo(() => {
    const chess = new Chess(line.fen);
    let lastMove;
    for (const san of line.moves.slice(0, ply)) lastMove = chess.move(san);
    for (const san of variation) lastMove = chess.move(san);
    return { board: chess, lastMove, legal: chess.moves({ verbose: true }) };
  }, [line, ply, variation]);

  function open(text: string, format: "PGN" | "FEN") {
    try {
      const chess = readNotation(text, format);
      const headers = chess.getHeaders();
      const moves = chess.history();
      setLine({ moves, result: headers.Result ?? "*", fen: format === "FEN" ? chess.fen() : headers.FEN });
      setPly(moves.length);
      setVariation([]);
      setSide("white");
      setError(null);
      setShowPosition(false);
      if (importPage) {
        history.replaceState(history.state, "", location.pathname + location.search);
        setImportPage(false);
      }
    } catch { setError(format); }
  }
  function navigate(next: number) {
    setPly(next);
    setVariation([]);
  }
  const importTitle = t("Импорт PGN или FEN", "Import PGN or FEN", "Importar PGN o FEN");
  const importFields = <fieldset className={styles.importFields} aria-label={t("Импорт позиции или партии", "Import a position or game", "Importar una posición o partida")}>
        <label>{t("PGN или FEN", "PGN or FEN", "PGN o FEN")} <textarea rows={5} value={input} onChange={event => setInput(event.target.value)} /></label>
        <div className={styles.buttons}><button className="atlas-primary" onClick={() => open(input, "PGN")}>{t("Открыть PGN", "Open PGN", "Abrir PGN")}</button>
        <button onClick={() => open(input, "FEN")}>{t("Открыть FEN", "Open FEN", "Abrir FEN")}</button></div>
        <label>{t("Файл PGN", "PGN file", "Archivo PGN")} <input type="file" accept=".pgn" onChange={async event => {
          const file = event.target.files?.[0];
          if (file) { try { open(await file.text(), "PGN"); } catch { setError("file"); } }
        }} /></label>
      </fieldset>;
  const message = error && <p role="alert">{error === "game" ? t("Не удалось открыть запись завершённой партии.", "Could not open the finished game.", "No se pudo abrir la partida finalizada.") :
      error === "file" ? t("Не удалось прочитать файл.", "Could not read the file.", "No se pudo leer el archivo.") :
      t(`Не удалось прочитать ${error}. Проверьте запись.`, `Could not read ${error}. Check the notation.`, `No se pudo leer el formato ${error}. Comprueba la notación.`)}</p>;
  const title = t("Анализ", "Analysis", "Análisis");
  const position = boardPosition(board);
  const white = t("Белые", "White", "Blancas");
  const black = t("Чёрные", "Black", "Negras");
  if (loading) return <main className="atlas-page" lang={language}><h1>{title}</h1>
    <section className="atlas-card"><p role="status">{t("Загрузка позиции…", "Loading position…", "Cargando la posición…")}</p></section></main>;
  if (importPage) return <main className="atlas-page" lang={language}><h1>{importTitle}</h1>
    <div className="atlas-columns"><section className="atlas-card"><h2>{t("Запись партии", "Game notation", "Notación de la partida")}</h2>
      {importFields}{message}<a href="#">{t("К анализу", "Back to analysis", "Volver al análisis")}</a></section>
      <aside className={`atlas-card ${panelStyles.boardPreview}`}><h2>{t("Предпросмотр", "Preview", "Vista previa")}</h2>
        <Board position={preview ? boardPosition(preview) : position} flipped={side === "black"} />
        <p className="atlas-muted">{t("Откройте FEN для одной позиции или PGN для записи всей партии.", "Open a FEN for one position or a PGN for the complete game.", "Abre un FEN para una posición o un PGN para la partida completa.")}</p>
      </aside></div></main>;
  const moves = t("Ходы", "Moves", "Jugadas");
  return <BoardLayout lang={language} title={title} board={<>
    <BoardSeat side={side === "black" ? "white" : "black"} name={side === "black" ? white : black} />
    <PlayBoard positionKey={board.fen()} enabled game={{ position, side, last_uci: lastMove?.lan,
      turn: board.turn() === "w" ? "white" : "black", legal: legal.map(move => move.lan) }}
      onMove={uci => { const move = legal.find(choice => choice.lan === uci);
        if (move) setVariation([...variation, move.san]); }} />
    <BoardSeat side={side === "black" ? "black" : "white"} name={side === "black" ? black : white} />
  </>} actions={<div className={styles.session}>
    <h2>{t("Запись ходов", "Move record", "Registro de jugadas")}</h2>
    <div className={styles.buttons}><button aria-pressed={!showPosition} onClick={() => setShowPosition(false)}>{moves}</button>
      <button aria-pressed={showPosition} onClick={() => setShowPosition(true)}>{t("Позиция", "Position", "Posición")}</button></div>
    {showPosition ? <div className={styles.notation}><b>FEN</b><p>{board.fen()}</p></div> : <>
      <MoveTable line={line} ply={ply} onSelect={navigate} />
      <nav aria-label={t("Ходы записи", "Game moves", "Jugadas de la partida")}><ReplayButtons ply={ply} total={line.moves.length} onSelect={navigate} /></nav></>}
    <h2>{t("Ручной анализ", "Manual analysis", "Análisis manual")}</h2>
    {variation.length ? <><p aria-live="polite">{t("Вариант", "Variation", "Variante")} · {variation.join(" ")}</p>
      <button onClick={() => setVariation(variation.slice(0, -1))}>{t("Отменить ход варианта", "Undo variation move", "Deshacer la última jugada de la variante")}</button>
      <button onClick={() => setVariation([])}>{t("Вернуться к исходной позиции", "Return to original position", "Volver a la posición original")}</button></> :
      <p className="atlas-muted">{t("Переместите фигуру, чтобы начать вариант из текущей позиции.", "Move a piece to start a variation from this position.", "Mueve una pieza para iniciar una variante desde esta posición.")}</p>}
    <a className="atlas-primary" href="#import">{importTitle}</a>
    {id && <a href={"?game=" + encodeURIComponent(id)}>{t("Вернуться к партии", "Return to game", "Volver a la partida")}</a>}
  </div>} footer={<section className={`atlas-card ${styles.quickImport}`}>
    <h2>{t("Импорт позиции или партии", "Import a position or game", "Importar una posición o partida")}</h2>
    {line.moves.length > 0 && <p className={styles.notation}>{t("Запись", "Game score", "Planilla")} · {line.moves.join(" ")} {line.result}</p>}
    {importFields}{message}</section>} />;
}
