import { ReplayButtons } from "../../shared/replay";
import { useLanguage } from "../../shared/language";
import React, { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { boardPosition } from "../../entities/board";
import { PlayBoard, requestGame } from "../../features/play";

interface Line {
  moves: string[];
  result: string;
  fen?: string;
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

  const board = useMemo(() => {
    const chess = new Chess(line.fen);
    for (const san of line.moves.slice(0, ply)) chess.move(san);
    for (const san of variation) chess.move(san);
    return chess;
  }, [line, ply, variation]);
  const legal = board.moves({ verbose: true });

  function open(text: string, format: "PGN" | "FEN") {
    try {
      if (!text.trim()) throw Error();
      const chess = format === "FEN" ? new Chess(text.trim()) : new Chess();
      if (format === "PGN") chess.loadPgn(text);
      const headers = chess.getHeaders();
      const moves = chess.history();
      setLine({ moves, result: headers.Result ?? "*", fen: format === "FEN" ? chess.fen() : headers.FEN });
      setPly(moves.length);
      setVariation([]);
      setSide("white");
      setError(null);
    } catch { setError(format); }
  }
  function navigate(next: number) {
    setPly(next);
    setVariation([]);
  }
  return <main className="analysis-page" lang={language}><h1>{t("Анализ", "Analysis")}</h1>
    {id && <a href={"?game=" + encodeURIComponent(id)}>{t("Вернуться к партии", "Return to game")}</a>}
    {loading ? <p>{t("Загрузка позиции…", "Loading position…")}</p> : <>
      <PlayBoard key={board.fen()} enabled game={{ position: boardPosition(board), side,
        turn: board.turn() === "w" ? "white" : "black", legal: legal.map(move => move.lan) }}
        onMove={uci => { const move = legal.find(choice => choice.lan === uci);
          if (move) setVariation([...variation, move.san]); }} />
      <nav aria-label={t("Ходы записи", "Game moves")}>
        <ReplayButtons ply={ply} total={line.moves.length} onSelect={navigate} />
      </nav>
      <p>{t("Запись", "Game score")} · {line.moves.join(" ")} {line.result}</p>
      {variation.length > 0 && <><p aria-live="polite">{t("Вариант", "Variation")} · {variation.join(" ")}</p>
        <button onClick={() => setVariation(variation.slice(0, -1))}>{t("Отменить ход варианта", "Undo variation move")}</button>
        <button onClick={() => setVariation([])}>{t("Вернуться к исходной позиции", "Return to original position")}</button></>}
      <fieldset><legend>{t("Импорт позиции или партии", "Import a position or game")}</legend>
        <label>{t("PGN или FEN", "PGN or FEN")} <textarea value={input} onChange={event => setInput(event.target.value)} /></label>
        <button onClick={() => open(input, "PGN")}>{t("Открыть PGN", "Open PGN")}</button>
        <button onClick={() => open(input, "FEN")}>{t("Открыть FEN", "Open FEN")}</button>
        <label>{t("Файл PGN", "PGN file")} <input type="file" accept=".pgn" onChange={async event => {
          const file = event.target.files?.[0];
          if (file) { try { open(await file.text(), "PGN"); } catch { setError("file"); } }
        }} /></label>
      </fieldset>
    </>}
    {error && <p role="alert">{error === "game" ? t("Не удалось открыть запись завершённой партии.", "Could not open the finished game.") :
      error === "file" ? t("Не удалось прочитать файл.", "Could not read the file.") :
      t(`Не удалось прочитать ${error}. Проверьте запись.`, `Could not read ${error}. Check the notation.`)}</p>}
  </main>;
}
