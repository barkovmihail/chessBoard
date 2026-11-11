import React, { useEffect, useState } from "react";
import { Game, PlayBoard, RequestError, requestGame } from "../../features/play";
import styles from "./game.module.css";

interface Command { uci: string; version: number; command_id: string }

export function GamePage() {
  const [game, setGame] = useState<Game>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Command>();

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("game");
    if (!id) return;
    let active = true;
    setBusy(true);
    requestGame("/" + encodeURIComponent(id)).then(result => {
      if (active) setGame(result);
    }).catch(() => { if (active) setError("Не удалось открыть партию. Обновите страницу."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await requestGame("", {});
      history.replaceState(null, "", "?game=" + result.id);
      setGame(result);
    } catch { setError("Не удалось создать партию. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }

  async function submit(command: Command) {
    if (!game) return;
    setBusy(true);
    setPending(command);
    setError("");
    try {
      const result = await requestGame("/" + game.id + "/moves", command);
      setGame(result);
      setPending(undefined);
    } catch (failure) {
      if (failure instanceof RequestError) {
        try {
          setGame(await requestGame("/" + game.id));
          setPending(undefined);
          setError("Позиция обновлена. Выберите ход ещё раз.");
        } catch { setError("Связь потеряна. Повторите отправку."); }
      } else setError("Связь потеряна. Повторите отправку.");
    } finally { setBusy(false); }
  }

  return <main className={styles.app}>
    <PlayBoard key={game?.version} game={game} enabled={!!game && !busy && !pending && !game.result}
      onMove={uci => game && submit({ uci, version: game.version, command_id: crypto.randomUUID() })} />
    {!game && <button disabled={busy} onClick={create}>Начать партию</button>}
    {game && <section aria-live="polite">
      <p>{game.result ?? (game.turn === "white" ? "Ход белых" : "Ход чёрных")}</p>
      <p>{game.moves.join(" ")}</p>
    </section>}
    {error && <p role="alert">{error}</p>}
    {pending && !busy && <button onClick={() => submit(pending)}>Повторить отправку</button>}
  </main>;
}
