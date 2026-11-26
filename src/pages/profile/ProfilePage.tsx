import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { PuzzleProgress } from "./PuzzleProgress";
import { Account } from "./Account";
import { resultReason, requestGame, type Game } from "../../features/play";
import { Chess } from "chess.js";
import { Board, boardPosition } from "../../entities/board";
import { panelStyles as styles } from "../../shared/page-panels";

interface Entry {
  id: string;
  opponent: string | null;
  side: "white" | "black" | "both";
  result: string;
  reason: string;
  base_minutes: number | null;
  increment_seconds: number | null;
  finished_ms: number | null;
}

function validEntry(row: Entry) {
  return row && typeof row.id === "string" && (row.opponent === null || typeof row.opponent === "string") && ["white", "black", "both"].includes(row.side) &&
    typeof row.result === "string" && typeof row.reason === "string" &&
    [row.finished_ms, row.base_minutes, row.increment_seconds].every(n => n === null || Number.isSafeInteger(n));
}

type HistorySide = "all" | "white" | "black";
interface HistoryPage { items: Entry[]; next_offset: number | null }

async function historyPage(offset: number, side: HistorySide, signal: AbortSignal): Promise<HistoryPage> {
  const params = new URLSearchParams({ offset: String(offset), side });
  const response = await fetch("/api/profile/games?" + params, { signal });
  if (!response.ok) throw Error();
  const data: HistoryPage = await response.json();
  if (!Array.isArray(data?.items) || !data.items.every(validEntry) ||
      !(data.next_offset === null || Number.isSafeInteger(data.next_offset) && data.next_offset > offset)) throw Error();
  return data;
}

function GameHistory({ onLatest }: { onLatest?: (entry: Entry | undefined) => void }) {
  const { language, t } = useLanguage();
  const [offsets, setOffsets] = useState([0]);
  const [side, setSide] = useState<HistorySide>(() => {
    const saved = onLatest && new URLSearchParams(location.search).get("side");
    return saved === "white" || saved === "black" ? saved : "all";
  });
  const offset = offsets[offsets.length - 1];
  const [page, setPage] = useState<HistoryPage>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setPage(undefined);
    onLatest?.(undefined);
    setError(false);
    historyPage(offset, side, abort.signal).then(data => {
      if (!abort.signal.aborted) { setPage(data); onLatest?.(data.items[0]); }
    }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [offset, side, retry, onLatest]);
  return <section className="atlas-card"><h2>{t("История игр", "Game history", "Historial de partidas")}</h2>
    {onLatest && <div className={styles.modeSwitch} role="group" aria-label={t("Цвет фигур", "Piece colour", "Color de las piezas")}>
      {(["all", "white", "black"] as const).map(value => <button key={value} aria-pressed={side === value} onClick={() => {
        const url = new URL(location.href);
        if (value === "all") url.searchParams.delete("side");
        else url.searchParams.set("side", value);
        history.replaceState(history.state, "", url);
        setOffsets([0]); setSide(value);
      }}>{value === "all" ? t("Все", "All", "Todas") : value === "white" ? t("Белые", "White", "Blancas") : t("Чёрные", "Black", "Negras")}</button>)}
    </div>}
    {error ? <p role="alert">{t("Не удалось загрузить партии.", "Could not load games.", "No se pudieron cargar las partidas.")} <button onClick={() => setRetry(retry + 1)}>{t("Повторить", "Retry", "Reintentar")}</button></p> :
      !page ? <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p> : <>
        {!page.items.length && <p className="atlas-muted">{side === "all" ? t("Завершённых партий пока нет", "No finished games yet", "Todavía no hay partidas finalizadas")
          : t("Партий за выбранную сторону пока нет.", "No games with this colour yet.", "Todavía no hay partidas con este color.")}</p>}
        <ul className={styles.history}>{page.items.map(game => <li key={game.id}><a href={"?game=" + encodeURIComponent(game.id)}>
          <span><strong>{game.side === "both" ? t("На одном устройстве", "On one device", "En un mismo dispositivo") : game.opponent ?? t("Гость", "Guest", "Invitado")}</strong>
            {game.side !== "both" && <small>{game.side === "white" ? t("Вы играли белыми", "You played White", "Jugaste con blancas") : t("Вы играли чёрными", "You played Black", "Jugaste con negras")}</small>}</span>
          <span>{game.base_minutes === null ? t("Без часов", "Unlimited", "Sin reloj") : game.base_minutes + "+" + game.increment_seconds} · {game.result} · {resultReason(game.reason, language)}</span>
          {game.finished_ms === null ? <small>{t("Дата неизвестна", "Unknown date", "Fecha desconocida")}</small> : <time dateTime={new Date(game.finished_ms).toISOString()}>{new Date(game.finished_ms).toLocaleString(language)}</time>}
        </a></li>)}</ul>
        <div className={styles.actions}>{offsets.length > 1 && <button onClick={() => setOffsets(offsets.slice(0, -1))}>{t("Предыдущая страница", "Previous page", "Página anterior")}</button>}
        {page.next_offset !== null && <button onClick={() => setOffsets([...offsets, page.next_offset!])}>{t("Следующая страница", "Next page", "Página siguiente")}</button>}</div>
        {!onLatest && page.items.length > 0 && <a className={styles.rowLink} href="?section=profile&view=history">{t("Вся история", "Full history", "Todo el historial")}</a>}
      </>}
  </section>;
}

const opening = boardPosition(new Chess("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"));
const mate = boardPosition(new Chess("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1"));

function ArchivePreview({ entry }: { entry?: Entry }) {
  const { t, language } = useLanguage();
  const [game, setGame] = useState<Game>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setGame(undefined);
    setFailed(false);
    if (entry) requestGame("/" + encodeURIComponent(entry.id)).then(data => { if (active) setGame(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [entry]);
  return <section className="atlas-card"><h2>{t("О партии", "Game details", "Sobre la partida")}</h2>
    {entry ? <>{game ? <div className={styles.board}><Board position={game.position} flipped={entry.side === "black"} highlight={game.last_uci ?? undefined} /></div> :
      <p role="status">{failed ? t("Не удалось загрузить позицию.", "Could not load the position.", "No se pudo cargar la posición.") : t("Загрузка…", "Loading…", "Cargando…")}</p>}
      <h3>{entry.side === "both" ? t("На одном устройстве", "On one device", "En un mismo dispositivo") : entry.opponent ?? t("Гость", "Guest", "Invitado")}</h3>
      <p>{entry.result} · {resultReason(entry.reason, language)}</p>
      <a className="atlas-primary" href={"?game=" + encodeURIComponent(entry.id)}>{t("Открыть партию", "Open game", "Abrir partida")}</a></> :
      <p className="atlas-muted">{t("Здесь появится последняя партия из списка.", "The latest game in the list will appear here.", "Aquí aparecerá la última partida de la lista.")}</p>}
  </section>;
}

export function ProfilePage({ onInbox }: { onInbox: () => void }) {
  const { t, language } = useLanguage();
  const query = new URLSearchParams(location.search);
  const [identity, setIdentity] = useState<string | null>();
  const [register, setRegister] = useState(query.get("mode") === "register");
  const [latest, setLatest] = useState<Entry>();
  const view = query.get("settings") === "1" ? (identity === null ? "account" : "events") :
    query.get("view") ?? (location.hash === "#account" ? "account" : "profile");
  const archive = view === "history", progress = view === "progress", events = view === "events", auth = view === "account";
  const overview = !archive && !progress && !events && !auth;
  const title = archive ? t("История партий", "Game archive", "Archivo de partidas") : progress ? t("Прогресс", "Progress", "Progreso") :
    events ? t("Настройки уведомлений", "Notification settings", "Ajustes de notificaciones") : auth && !identity ?
      register ? t("Регистрация", "Registration", "Registro") : t("Вход", "Sign in", "Iniciar sesión") : t("Профиль", "Profile", "Perfil");
  return <main className="atlas-page" lang={language}><h1 className="atlas-heading">{title}</h1>
    <div className={"atlas-columns" + (auth ? " " + styles.authColumns : "")}><div className={styles.stack}>
      {(overview || auth || events) && <Account auth={auth} onIdentity={setIdentity} register={register} onMode={setRegister} settings={events} />}
      {(overview || archive) && <GameHistory onLatest={archive ? setLatest : undefined} />}
      {(overview || progress) && <PuzzleProgress />}
    </div><aside className={styles.stack}>
      {archive ? <ArchivePreview entry={latest} /> : progress ? <section className="atlas-card"><h2>{t("По темам", "By theme", "Por tema")}</h2>
        <div className={styles.board}><Board position={mate} /></div><h3>{t("Мат в один ход", "Mate in one", "Mate en una")}</h3>
        <p>{t("Белые начинают.", "White to move.", "Juegan las blancas.")}</p><a className="atlas-primary" href="?section=puzzles&theme=mateIn1">{t("Решать задачи", "Solve puzzles", "Resolver problemas")}</a>
      </section> : events ? <section className="atlas-card"><h2>{t("Пример уведомления", "Notification preview", "Vista previa de notificación")}</h2>
        <h3>{t("Ваш ход", "Your turn", "Tu turno")}</h3><p>{t("Блиц", "Blitz", "Blitz")} · 5 + 3</p>
        <a className={styles.rowLink} href="?section=feed">{t("Открыть ленту", "Open notifications", "Abrir notificaciones")}</a>
      </section> : auth || identity === null ? <section className="atlas-card"><h2>{t("Ваши партии", "Your games", "Tus partidas")}</h2>
        <div className={styles.board}><Board position={opening} highlight="g1f3" /></div><h3>{t("Личный архив", "Personal archive", "Archivo personal")}</h3>
        <p>{t("В профиле хранятся история игр, рейтинг и прогресс в задачах.", "Your profile holds your game history, ratings and puzzle progress.", "Tu perfil guarda el historial de partidas, tus puntuaciones y el progreso en problemas.")}</p>
      </section> : null}
      {overview && <section className="atlas-card"><h2>{t("Личный кабинет", "Player dashboard", "Panel del jugador")}</h2><ul className={styles.list}>
        <li><a className={styles.rowLink} href="?section=teams">{t("Состав и приглашения", "Members and invitations", "Miembros e invitaciones")}</a></li>
        <li><button className={styles.rowLink} onClick={onInbox}>{t("Входящие", "Inbox", "Bandeja de entrada")}</button></li>
        <li><a className={styles.rowLink} href="?section=profile&view=history">{t("Архив партий", "Game archive", "Archivo de partidas")}</a></li>
        <li><a className={styles.rowLink} href="?section=profile&view=progress">{t("Статистика задач", "Puzzle statistics", "Estadísticas de problemas")}</a></li>
        <li><a className={styles.rowLink} href="?section=settings">{t("Оформление и звук", "Appearance and sound", "Apariencia y sonido")}</a></li>
      </ul></section>}
    </aside></div>
  </main>;
}
