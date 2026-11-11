import React, { useEffect, useRef, useState } from "react";
import { Game, gameCue, PlayBoard, reasons, RequestError, requestGame, subscribeGame } from "../../features/play";
import { playSound } from "../../shared/sound";
import { ClockPanel, TimeSetup } from "./TimeControl";
import { GameReview } from "./GameReview";
import styles from "./game.module.css";

type Action = "rematch" | "offer" | "accept" | "decline" | "resign" | "claim" | `claim:${string}`;
type Command = { version: number; command_id: string } & ({ uci: string } | { action: Action });

function commandId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function GamePage() {
  const [game, setGame] = useState<Game>();
  const confirmed = useRef<Game>();
  function receive(next: Game, quiet = false) {
    const previous = confirmed.current;
    if (previous?.id === next.id && previous.version > next.version) return;
    confirmed.current = next;
    setGame(next);
    if (previous && !quiet) {
      const cue = gameCue(previous, next);
      if (cue) playSound(cue);
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [inviteControl, setInviteControl] = useState("");
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
      if (active) receive(result, true);
    }).catch(() => { if (active) setError("Не удалось открыть партию. Обновите страницу."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!invite) return;
    const abort = new AbortController();
    fetch("/api/games/" + encodeURIComponent(invite) + "/invitation", { signal: abort.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(control => setInviteControl(control.base_minutes === null ? "Без часов" :
        control.base_minutes + "+" + control.increment_seconds))
      .catch(() => { if (!abort.signal.aborted) setInviteControl("Не удалось загрузить контроль времени"); });
    return () => abort.abort();
  }, [invite]);

  const onlineId = game && !game.next_game && (game.side !== "both" || (game.clock && !game.result)) ? game.id : undefined;
  useEffect(() => {
    if (!onlineId) return;
    return subscribeGame(onlineId, (result, restored) => {
      if (result.next_game) location.assign("?game=" + result.next_game);
      else receive(result, restored);
    }, setDisconnected);
  }, [onlineId]);

  async function create(online: boolean, control?: { minutes: number; increment: number }) {
    setBusy(true);
    setError("");
    try {
      const result = invite ? await requestGame("/" + encodeURIComponent(invite) + "/join", {})
        : await requestGame("", { online, control });
      setInvite(undefined);
      history.replaceState(null, "", "?game=" + result.id);
      receive(result, true);
      if (!result.waiting && !result.result && !result.moves.length) playSound("start");
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
      receive(result);
      if (result.next_game && "action" in command && command.action === "rematch") location.assign("?game=" + result.next_game);
      setPending(undefined);
    } catch (failure) {
      if (failure instanceof RequestError) {
        try {
          receive(await requestGame("/" + game.id), true);
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
    {game?.result ? <GameReview key={game.id} game={game} /> : <PlayBoard key={game?.version} game={game} enabled={!!game && !game.waiting && (game.side === "both" || game.side === game.turn) && !busy && !pending && !game.result}
      onMove={uci => game && submit({ uci, version: game.version, command_id: commandId() })} />}
    {!game && (invite
      ? <><p>{inviteControl}</p><button disabled={busy || !inviteControl} onClick={() => create(true)}>Играть за чёрных</button></>
      : <TimeSetup busy={busy} create={create} />)}
    {game?.clock && <ClockPanel game={game} clock={game.clock} />}
    {game?.waiting && <label>Ссылка для соперника <input readOnly value={location.origin + location.pathname + "?invite=" + game.id}
      onFocus={event => event.target.select()} /></label>}
    {game && <section aria-live="polite">
      <p>{game.waiting ? "Ожидание соперника" : game.result ?? (game.turn === "white" ? "Ход белых" : "Ход чёрных")}</p>
      {game.previous_game && <a href={"?game=" + game.previous_game}>Предыдущая партия</a>}
      {game.next_game ? <a href={"?game=" + game.next_game}>Открыть реванш</a> :
        game.result && game.side !== "both" && (game.rematch_offer === game.side ? <p>Реванш предложен</p> :
          <button disabled={busy || !!pending} onClick={() => act("rematch")}>
            {game.rematch_offer ? "Принять реванш" : "Предложить реванш"}
          </button>)}
      <p>{game.rated ? "Рейтинговая игра" : "Нерейтинговая игра"}</p>
      {game.reason && <p>{reasons[game.reason] ?? game.reason}</p>}
      {!game.result && (game.side === "both" || game.side === game.turn) && Object.entries(game.claims ?? {}).map(([key, reason]) =>
        <button key={key} disabled={busy || !!pending} onClick={() => act(key === "claim" ? "claim" : `claim:${key.slice(6)}`)}>
          Заявить ничью · {reasons[reason]}{key.includes(":") && " · " + key.slice(6, 8) + "–" + key.slice(8)}
        </button>)}
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
