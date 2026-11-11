import React, { useEffect, useState } from "react";
import { Game, PlayBoard, RequestError, requestGame, subscribeGame } from "../../features/play";
import styles from "./game.module.css";

type Action = "offer" | "accept" | "decline" | "resign";
type Command = { version: number; command_id: string } & ({ uci: string } | { action: Action });

const reasons: Record<string, string> = {
  resignation: "Сдача", agreement: "Ничья по соглашению", checkmate: "Мат", stalemate: "Пат",
  insufficient_material: "Недостаточно материала", fivefold_repetition: "Пятикратное повторение",
  seventyfive_moves: "Правило 75 ходов",
};

function commandId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function GamePage() {
  const [game, setGame] = useState<Game>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [invite, setInvite] = useState<string>();
  const [pending, setPending] = useState<Command>();

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    setInvite(query.get("invite") ?? undefined);
    const id = query.get("game");
    if (!id) return;
    let active = true;
    setBusy(true);
    requestGame("/" + encodeURIComponent(id)).then(result => {
      if (active) setGame(result);
    }).catch(() => { if (active) setError("Не удалось открыть партию. Обновите страницу."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const onlineId = game && game.side !== "both" && !game.result ? game.id : undefined;
  useEffect(() => {
    if (!onlineId) return;
    return subscribeGame(onlineId, result => {
      setGame(previous => previous && previous.version > result.version ? previous : result);
    }, setDisconnected);
  }, [onlineId]);

  async function create(online: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = invite ? await requestGame("/" + encodeURIComponent(invite) + "/join", {})
        : await requestGame("", { online });
      setInvite(undefined);
      history.replaceState(null, "", "?game=" + result.id);
      setGame(result);
    } catch (failure) { setError(failure instanceof RequestError && failure.message === "seat_taken"
      ? "Оба места уже заняты." : "Не удалось открыть партию. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }

  async function submit(command: Command) {
    if (!game) return;
    setBusy(true);
    setPending(command);
    setError("");
    try {
      const result = await requestGame("/" + game.id + ("action" in command ? "/actions" : "/moves"), command);
      setGame(previous => previous && previous.version > result.version ? previous : result);
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

  function act(action: Action) {
    if (game) submit({ action, version: game.version, command_id: commandId() });
  }

  return <main className={styles.app}>
    <PlayBoard key={game?.version} game={game} enabled={!!game && !game.waiting && (game.side === "both" || game.side === game.turn) && !busy && !pending && !game.result}
      onMove={uci => game && submit({ uci, version: game.version, command_id: commandId() })} />
    {!game && (invite
      ? <button disabled={busy} onClick={() => create(true)}>Играть за чёрных</button>
      : <><button disabled={busy} onClick={() => create(false)}>Начать партию</button>
        <button disabled={busy} onClick={() => create(true)}>Пригласить друга</button></>)}
    {game?.waiting && <label>Ссылка для соперника <input readOnly value={location.origin + location.pathname + "?invite=" + game.id}
      onFocus={event => event.target.select()} /></label>}
    {game && <section aria-live="polite">
      <p>{game.waiting ? "Ожидание соперника" : game.result ?? (game.turn === "white" ? "Ход белых" : "Ход чёрных")}</p>
      {game.reason && <p>{reasons[game.reason] ?? game.reason}</p>}
      {game.side !== "both" && !game.result && !game.waiting && <fieldset disabled={busy || !!pending}>
        {game.draw_offer === null ? <button onClick={() => act("offer")}>Предложить ничью</button>
          : game.draw_offer === game.side ? <span>Ничья предложена</span>
          : <><button onClick={() => act("accept")}>Принять ничью</button>
            <button onClick={() => act("decline")}>Отклонить ничью</button></>}
        <button onClick={() => act("resign")}>Сдаться</button>
      </fieldset>}
      <p>{game.moves.join(" ")}</p>
    </section>}
    {disconnected && onlineId && <p role="status">Восстанавливаем связь с партией…</p>}
    {error && <p role="alert">{error}</p>}
    {pending && !busy && <button onClick={() => submit(pending)}>Повторить отправку</button>}
  </main>;
}
