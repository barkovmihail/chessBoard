import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { Game, gameCue, levelLabels, PlayBoard, resultReason, RequestError, requestGame, subscribeGame } from "../../features/play";
import { commandId } from "../../shared/commandId";
import { playSound } from "../../shared/sound";
import { ClockPanel, PositionPreview, TimeSetup } from "./TimeControl";
import { MoveRecord } from "./MoveRecord";
import { GameReview } from "./GameReview";
import { BoardLayout } from "../../shared/board-layout";
import { ConfirmAction } from "../../shared/confirm-action";
import styles from "./game.module.css";

const errors = {
  open: ["Не удалось открыть партию. Обновите страницу.", "Could not open the game. Reload the page.", "No se pudo abrir la partida. Recarga la página."],
  full: ["Оба места уже заняты.", "Both seats are taken.", "Las dos plazas ya están ocupadas."],
  engine: ["Выбранный движок недоступен на сервере.", "The selected engine is unavailable.", "El motor seleccionado no está disponible."],
  create: ["Не удалось открыть партию. Попробуйте ещё раз.", "Could not open the game. Try again.", "No se pudo abrir la partida. Inténtalo de nuevo."],
  visibility: ["Не удалось подтвердить изменение доступа. Проверьте ссылку и повторите попытку.", "Could not confirm spectator access. Check the link and try again.", "No se pudo confirmar el acceso de espectadores. Comprueba el enlace e inténtalo de nuevo."],
  position: ["Позиция обновлена. Выберите ход ещё раз.", "The position has changed. Choose your move again.", "La posición ha cambiado. Elige tu jugada de nuevo."],
  offline: ["Связь потеряна. Повторите отправку.", "Connection lost. Retry sending.", "Se ha perdido la conexión. Vuelve a enviar la jugada."],
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
  const [copyMessage, setCopyMessage] = useState<"copied" | "manual">();
  const invitationField = useRef<HTMLInputElement>(null);

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

  const board = <PlayBoard positionKey={game?.version} game={game} enabled={!!game && !game.waiting && (game.side === "both" || game.side === game.turn) && !busy && !pending}
      onMove={uci => game && submit({ uci, version: game.version, command_id: commandId() })} />;
  const context = game ? <>
    <p>{game.rated ? t("Рейтинговая игра", "Rated game", "Partida puntuada") : t("Нерейтинговая игра", "Casual game", "Partida amistosa")}</p>
    <button disabled={busy || !!pending} onClick={setVisibility}>{game.watch_key ? t("Закрыть просмотр", "Disable spectator access", "Desactivar el acceso de espectadores") : t("Открыть просмотр по ссылке", "Allow spectators with the link", "Permitir espectadores con el enlace")}</button>
    {game.arena_id && <a href={"?section=arenas&arena=" + game.arena_id}>{t("Вернуться на арену", "Return to arena", "Volver a la arena")}</a>}
    {game.watch_key && <a href={"?watch=" + game.watch_key}>{t("Ссылка для зрителей", "Spectator link", "Enlace para espectadores")}</a>}
    {game.chess960 != null && <p>Chess960 · {t("Расстановка №", "Position #", "Posición n.º ")}{game.chess960}. {t("Для рокировки переместите короля на свою ладью.", "To castle, move your king onto your rook.", "Para enrocar, mueve el rey a la casilla de tu torre.")}</p>}
    {game.engine_level && <p>{t("Чёрные", "Black", "Negras")} · {game.engine_name === "stockfish" ? "Stockfish" : "Leela Chess Zero"} · {t(levelLabels[game.engine_level][0], levelLabels[game.engine_level][1], levelLabels[game.engine_level][2])}</p>}
  </> : null;
  const status = game && <div className={styles.gameStatus}><span aria-live="polite">{game.waiting ? t("Ожидание соперника", "Waiting for opponent", "Esperando al rival") :
    game.result ?? (game.turn === "white" ? t("Ход белых", "White to move", "Juegan blancas") : t("Ход чёрных", "Black to move", "Juegan negras"))}</span>
      {game.reason && <p>{resultReason(game.reason, language)}</p>}
    {disconnected && onlineId && <p role="status">{t("Восстанавливаем связь с партией…", "Reconnecting to the game…", "Reconectando con la partida…")}</p>}
  </div>;
  const actions = game && <>
      {game.previous_game && <a href={"?game=" + game.previous_game}>{t("Предыдущая партия", "Previous game", "Partida anterior")}</a>}
      {game.next_game ? <a href={"?game=" + game.next_game}>{t("Открыть реванш", "Open rematch", "Abrir la revancha")}</a> :
        game.result && !game.engine_level && game.side !== "both" && (game.rematch_offer === game.side ? <p>{t("Реванш предложен", "Rematch offered", "Revancha propuesta")}</p> :
          <button disabled={busy || !!pending} onClick={() => act("rematch")}>
            {game.rematch_offer ? t("Принять реванш", "Accept rematch", "Aceptar la revancha") : t("Предложить реванш", "Offer rematch", "Proponer una revancha")}
          </button>)}
      {!game.result && (game.side === "both" || game.side === game.turn) && Object.entries(game.claims ?? {}).map(([key, reason]) =>
        <button key={key} disabled={busy || !!pending} onClick={() => act(key === "claim" ? "claim" : `claim:${key.slice(6)}`)}>
          {t("Заявить ничью", "Claim a draw", "Reclamar tablas")} · {resultReason(reason, language)}{key.includes(":") && " · " + key.slice(6, 8) + "–" + key.slice(8)}
        </button>)}
      {game.side !== "both" && !game.result && !game.waiting && <fieldset disabled={busy || !!pending}>
        {!game.engine_level && (game.draw_offer === null ? <button onClick={() => act("offer")}>{t("Предложить ничью", "Offer draw", "Ofrecer tablas")}</button>
          : game.draw_offer === game.side ? <span>{t("Ничья предложена", "Draw offered", "Tablas ofrecidas")}</span>
          : <><button onClick={() => act("accept")}>{t("Принять ничью", "Accept draw", "Aceptar tablas")}</button>
            <button onClick={() => act("decline")}>{t("Отклонить ничью", "Decline draw", "Rechazar tablas")}</button></>)}
        <ConfirmAction label={t("Сдаться", "Resign", "Abandonar")}
          question={t("Сдаться в этой партии?", "Resign this game?", "¿Abandonar esta partida?")}
          description={t("Сопернику будет засчитана победа.", "Your opponent will win the game.", "Tu rival ganará la partida.")}
          onConfirm={() => act("resign")} />
      </fieldset>}
    {error && <p role="alert">{t(errors[error][0], errors[error][1], errors[error][2])}</p>}
    {pending && !busy && <button onClick={() => submit(pending)}>{t("Повторить отправку", "Retry sending", "Reintentar el envío")}</button>}
  </>;
  if (game?.waiting || (!game && invite)) {
    const control = game?.clock ? game.clock.base_minutes + "+" + game.clock.increment_seconds : inviteControl;
    const link = game && location.origin + location.pathname + "?invite=" + game.id;
    const inviteTitle = t("Приглашение друга", "Friend invitation", "Invitación a un amigo");
    return <main lang={language}><h1 className={styles.pageTitle}>{inviteTitle}</h1><div className={styles.lobby}>
      <PositionPreview invitation board={board} chess960={game?.chess960} />
      <section className={styles.invitation}>
        <h2>{game ? t("Приглашение готово", "Invitation ready", "Invitación lista") : t("Приглашение в партию", "Game invitation", "Invitación a una partida")}</h2>
        <svg aria-hidden="true" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m9 8 3-3a5 5 0 0 1 7 7l-3 3m-1 1-3 3a5 5 0 0 1-7-7l3-3m0 7 8-8"/></svg>
        <strong className={styles.inviteTime}>{control && control !== "unlimited" ? control : game || control === "unlimited" ? t("Без часов", "Unlimited", "Sin reloj") : ""}</strong>
        <p>{game ? t("Друг присоединится по приглашению. Партия начнётся после подключения.", "Share the invitation with your friend. The game starts when they join.", "Comparte la invitación con tu amigo. La partida empieza cuando se una.") : t("Примите приглашение, чтобы занять место за доской.", "Accept the invitation to take your seat at the board.", "Acepta la invitación para ocupar tu lugar en el tablero.")}</p>
        {link ? <>
          <label>{t("Ссылка для соперника", "Opponent link", "Enlace para el rival")}<input ref={invitationField} readOnly value={link} onFocus={e => e.target.select()} /></label>
          <button className={styles.primary} onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopyMessage("copied"); }
            catch { invitationField.current?.focus(); invitationField.current?.select(); setCopyMessage("manual"); }
          }}>{t("Скопировать ссылку", "Copy link", "Copiar enlace")}</button>
          {copyMessage && <p role="status">{copyMessage === "copied" ? t("Ссылка скопирована", "Link copied", "Enlace copiado") : t("Скопируйте выделенную ссылку.", "Copy the selected link.", "Copia el enlace seleccionado.")}</p>}
          {status}<a href="?section=inbox">{t("Текущие партии", "Current games", "Partidas en curso")} →</a>
          {context}
        </> : <>
          {inviteFailed && <p role="alert">{t("Не удалось загрузить контроль времени", "Could not load the time control", "No se pudo cargar el ritmo de juego")}</p>}
          <button className={styles.primary} disabled={busy || (!inviteControl && !inviteFailed)} onClick={() => create(true)}>{t("Играть за чёрных", "Play as Black", "Jugar con negras")}</button>
        </>}
        {error && <p role="alert">{t(errors[error][0], errors[error][1], errors[error][2])}</p>}
      </section>
    </div></main>;
  }
  if (!game) return <main>
    <TimeSetup busy={busy} create={create} board={board} />
    {error && <p role="alert">{t(errors[error][0], errors[error][1], errors[error][2])}</p>}
  </main>;
  const activeGame = game;
  const title = game.result ? t("Разбор партии", "Game review", "Revisión de la partida") :
    game.engine_level ? t("Партия с компьютером", "Computer game", "Partida contra el ordenador") :
    game.side === "both" ? t("Партия на одном устройстве", "Local game", "Partida en un dispositivo") : t("Партия с другом", "Game with a friend", "Partida con un amigo");
  function render(position: React.ReactElement, controls?: React.ReactElement, belowBoard?: React.ReactElement) {
    return <BoardLayout title={title} gameWorkspace lang={language}
      board={<><ClockPanel game={activeGame}>{position}</ClockPanel>{belowBoard}</>}
      actions={<>
        {controls ? <><h2>{t("Итоги партии", "Game summary", "Resumen de la partida")}</h2>{controls}</> :
          <><MoveRecord moves={activeGame.moves} pieceCount={activeGame.position.length} />{status}
            <div className={styles.moveInfo}>
              {activeGame.moves.length > 0 && <p>{t("Последний ход", "Last move", "Última jugada")} · {Math.ceil(activeGame.moves.length / 2)}{activeGame.moves.length % 2 ? ". " : "… "}{activeGame.moves[activeGame.moves.length - 1]}</p>}
              {activeGame.clock && <p>{activeGame.clock.base_minutes} {t("мин", "min", "min")} + {activeGame.clock.increment_seconds} {t("с за ход", "s per move", "s por jugada")}</p>}
            </div>
          </>}
        {actions}
      </>} context={context} />;
  }
  return game.result ? <GameReview key={game.id} game={game} summary={status} render={render} /> : render(board);
}
