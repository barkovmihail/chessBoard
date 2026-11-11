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
  const query = new URLSearchParams(location.search);
  const id = query.get("game");
  const requestedPly = Number(query.get("ply") ?? Infinity);
  const [line, setLine] = useState<Line>({ moves: [], result: "*" });
  const [ply, setPly] = useState(0);
  const [variation, setVariation] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
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
    }).catch(() => { if (active) setError("Не удалось открыть запись завершённой партии."); })
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
      setError("");
    } catch { setError("Не удалось прочитать " + format + ". Проверьте запись."); }
  }
  function navigate(next: number) {
    setPly(next);
    setVariation([]);
  }
  return <main><h1>Анализ</h1>
    {id && <a href={"?game=" + encodeURIComponent(id)}>Вернуться к партии</a>}
    {loading ? <p>Загрузка позиции…</p> : <>
      <PlayBoard key={board.fen()} enabled game={{ position: boardPosition(board), side,
        turn: board.turn() === "w" ? "white" : "black", legal: legal.map(move => move.lan) }}
        onMove={uci => { const move = legal.find(choice => choice.lan === uci);
          if (move) setVariation([...variation, move.san]); }} />
      <nav aria-label="Ходы записи">
        <button disabled={!ply} onClick={() => navigate(0)}>В начало</button>
        <button disabled={!ply} onClick={() => navigate(ply - 1)}>Назад</button>
        <button disabled={ply === line.moves.length} onClick={() => navigate(ply + 1)}>Вперёд</button>
        <button disabled={ply === line.moves.length} onClick={() => navigate(line.moves.length)}>В конец</button>
      </nav>
      <p>Запись · {line.moves.join(" ")} {line.result}</p>
      {variation.length > 0 && <><p aria-live="polite">Вариант · {variation.join(" ")}</p>
        <button onClick={() => setVariation(variation.slice(0, -1))}>Отменить ход варианта</button>
        <button onClick={() => setVariation([])}>Вернуться к исходной позиции</button></>}
      <fieldset><legend>Импорт позиции или партии</legend>
        <label>PGN или FEN <textarea value={input} onChange={event => setInput(event.target.value)} /></label>
        <button onClick={() => open(input, "PGN")}>Открыть PGN</button>
        <button onClick={() => open(input, "FEN")}>Открыть FEN</button>
        <label>Файл PGN <input type="file" accept=".pgn" onChange={async event => {
          const file = event.target.files?.[0];
          if (file) { try { open(await file.text(), "PGN"); } catch { setError("Не удалось прочитать файл."); } }
        }} /></label>
      </fieldset>
    </>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
