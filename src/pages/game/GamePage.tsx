import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { Game, gameCue, PlayBoard, resultReason, RequestError, requestGame, subscribeGame } from "../../features/play";
import { commandId } from "../../shared/commandId";
import { playSound } from "../../shared/sound";
import { ClockPanel, TimeSetup } from "./TimeControl";
import { GameReview } from "./GameReview";
import { BoardLayout } from "../../shared/board-layout";
import styles from "./game.module.css";

const errors = {
  open: ["Не удалось открыть партию. Обновите страницу.", "Could not open the game. Reload the page."],
  full: ["Оба места уже заняты.", "Both seats are taken."],
  engine: ["Выбранный движок недоступен на сервере.", "The selected engine is unavailable."],
  create: ["Не удалось открыть партию. Попробуйте ещё раз.", "Could not open the game. Try again."],
  visibility: ["Не удалось подтвердить изменение доступа. Проверьте ссылку и повторите попытку.", "Could not confirm spectator access. Check the link and try again."],
  position: ["Позиция обновлена. Выберите ход ещё раз.", "The position has changed. Choose your move again."],
  offline: ["Связь потеряна. Повторите отправку.", "Connection lost. Retry sending."],
} as const;

type Action = "rematch" | "offer" | "accept" | "decline" | "resign" | "claim" | `claim:${string}`;
type Command = { version: number; command_id: string } & ({ uci: string } | { action: Action });


export function GamePage({ onOpen }: { onOpen: (id: string) => void }) {
  const { language, t } = useLanguage();
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
  const [error, setError] = useState<keyof typeof errors | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [inviteControl, setInviteControl] = useState<string>();
  const [inviteFailed, setInviteFailed] = useState(false);
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
    }).catch(() => { if (active) setError("open"); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!invite) return;
    const abort = new AbortController();
    fetch("/api/games/" + encodeURIComponent(invite) + "/invitation", { signal: abort.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(control => setInviteControl(control.base_minutes === null ? "unlimited" :
        control.base_minutes + "+" + control.increment_seconds))
      .catch(() => { if (!abort.signal.aborted) setInviteFailed(true); });
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

  async function create(online: boolean, control?: { minutes: number; increment: number }, engine_level?: Game["engine_level"], engine_name?: Game["engine_name"], visible = false, chess960?: number) {
    setBusy(true);
    setError(null);
    try {
      const result = invite ? await requestGame("/" + encodeURIComponent(invite) + "/join", {})
        : await requestGame("", { online, control, engine_level, engine_name, public: visible, chess960 });
      setInvite(undefined);
      onOpen(result.id);
      receive(result, true);
      if (!result.waiting && !result.result && !result.moves.length) playSound("start");
    } catch (failure) { setError(failure instanceof RequestError && failure.message === "seat_taken"
      ? "full" : failure instanceof RequestError && failure.message === "engine_unavailable" ? "engine" : "create"); }
    finally { setBusy(false); }
  }

  async function setVisibility() {
    if (!game) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestGame("/" + game.id + "/visibility", { public: !game.watch_key, version: game.version });
      receive(result, true);
    } catch {
      try { receive(await requestGame("/" + game.id), true); } catch { /* Keep the last confirmed position. */ }
      setError("visibility");
    } finally { setBusy(false); }
  }

  async function submit(command: Command) {
    if (!game) return;
    setBusy(true);
    setPending(command);
    setError(null);
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
          setError("position");
        } catch { setError("offline"); }
      } else setError("offline");
    } finally { setBusy(false); }
  }

  function act(action: Action) {
    if (game) submit({ action, version: game.version, command_id: commandId() });
  }

  const board = <PlayBoard key={game?.version} game={game} enabled={!!game && !game.waiting && (game.side === "both" || game.side === game.turn) && !busy && !pending}
      onMove={uci => game && submit({ uci, version: game.version, command_id: commandId() })} />;
  const context = game ? <>
    <p>{game.rated ? t("Рейтинговая игра", "Rated game") : t("Нерейтинговая игра", "Casual game")}</p>
    <button disabled={busy || !!pending} onClick={setVisibility}>{game.watch_key ? t("Закрыть просмотр", "Disable spectator access") : t("Открыть просмотр по ссылке", "Allow spectators with the link")}</button>
    {game.arena_id && <a href={"?section=arenas&arena=" + game.arena_id}>{t("Вернуться на арену", "Return to arena")}</a>}
    {game.watch_key && <a href={"?watch=" + game.watch_key}>{t("Ссылка для зрителей", "Spectator link")}</a>}
    {game.chess960 != null && <p>Chess960 · {t("Расстановка №", "Position #")}{game.chess960}. {t("Для рокировки переместите короля на свою ладью.", "To castle, move your king onto your rook.")}</p>}
    {game.engine_level && <p>{t("Чёрные", "Black")} · {game.engine_name === "stockfish" ? "Stockfish" : "Leela Chess Zero"} · {game.engine_level === "easy" ? t("Начальный", "Beginner") : t("Обычный", "Normal")}</p>}
    {game.waiting && <label>{t("Ссылка для соперника", "Opponent link")} <input readOnly value={location.origin + location.pathname + "?invite=" + game.id}
      onFocus={event => event.target.select()} /></label>}
  </> : invite ? <><p>{inviteFailed ? t("Не удалось загрузить контроль времени", "Could not load the time control") : inviteControl === "unlimited" ? t("Без часов", "Unlimited") : inviteControl}</p><button disabled={busy || (!inviteControl && !inviteFailed)} onClick={() => create(true)}>{t("Играть за чёрных", "Play as Black")}</button></>
    : null;
  const status = game && <span aria-live="polite">{game.waiting ? t("Ожидание соперника", "Waiting for opponent") :
    game.result ?? (game.turn === "white" ? t("Ход белых", "White to move") : t("Ход чёрных", "Black to move"))}</span>;
  const actions = game && <>
      {game.previous_game && <a href={"?game=" + game.previous_game}>{t("Предыдущая партия", "Previous game")}</a>}
      {game.next_game ? <a href={"?game=" + game.next_game}>{t("Открыть реванш", "Open rematch")}</a> :
        game.result && !game.engine_level && game.side !== "both" && (game.rematch_offer === game.side ? <p>{t("Реванш предложен", "Rematch offered")}</p> :
          <button disabled={busy || !!pending} onClick={() => act("rematch")}>
            {game.rematch_offer ? t("Принять реванш", "Accept rematch") : t("Предложить реванш", "Offer rematch")}
          </button>)}
      {game.reason && <p>{resultReason(game.reason, language)}</p>}
      {!game.result && (game.side === "both" || game.side === game.turn) && Object.entries(game.claims ?? {}).map(([key, reason]) =>
        <button key={key} disabled={busy || !!pending} onClick={() => act(key === "claim" ? "claim" : `claim:${key.slice(6)}`)}>
          {t("Заявить ничью", "Claim a draw")} · {resultReason(reason, language)}{key.includes(":") && " · " + key.slice(6, 8) + "–" + key.slice(8)}
        </button>)}
      {game.side !== "both" && !game.result && !game.waiting && <fieldset disabled={busy || !!pending}>
        {!game.engine_level && (game.draw_offer === null ? <button onClick={() => act("offer")}>{t("Предложить ничью", "Offer draw")}</button>
          : game.draw_offer === game.side ? <span>{t("Ничья предложена", "Draw offered")}</span>
          : <><button onClick={() => act("accept")}>{t("Принять ничью", "Accept draw")}</button>
            <button onClick={() => act("decline")}>{t("Отклонить ничью", "Decline draw")}</button></>)}
        <button onClick={() => act("resign")}>{t("Сдаться", "Resign")}</button>
      </fieldset>}
      {game.moves.length > 0 && <ol aria-label={t("Запись ходов", "Move list")} className={styles.history}>
        {game.moves.map((move, index) => index % 2 === 0 && <li key={index}>
          <span>{move}</span>{" "}<span>{game.moves[index + 1]}</span>{" "}
        </li>)}
      </ol>}
    {disconnected && onlineId && <p role="status">{t("Восстанавливаем связь с партией…", "Reconnecting to the game…")}</p>}
    {error && <p role="alert">{t(errors[error][0], errors[error][1])}</p>}
    {pending && !busy && <button onClick={() => submit(pending)}>{t("Повторить отправку", "Retry sending")}</button>}
  </>;
  function render(position: React.ReactElement, controls?: React.ReactElement) {
    return <BoardLayout board={game ? <ClockPanel game={game}>{position}</ClockPanel> : position}
    context={<>{context}{!game && error && <p role="alert">{t(errors[error][0], errors[error][1])}</p>}</>} actions={controls ? <>{controls}{actions}</> : actions} status={status} />;
  }
  if (!game && !invite) return <main>
    <TimeSetup busy={busy} create={create} board={board} />
    {error && <p role="alert">{t(errors[error][0], errors[error][1])}</p>}
  </main>;
  return game?.result ? <GameReview key={game.id} game={game} render={render} /> : render(board);
}
