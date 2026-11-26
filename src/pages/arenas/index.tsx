import { ConfirmAction } from "../../shared/confirm-action";
import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { commandId } from "../../shared/commandId";
import { panelStyles as styles } from "../../shared/page-panels";

function arenaUrl(id: string) { return "?section=arenas&arena=" + encodeURIComponent(id); }

interface Arena {
  name: string; signed_in: boolean; joined: boolean; owner: boolean; players: string[];
  phase: "registration" | "playing" | "finishing" | "finished"; ends: number | null;
  game: string | null; played: number; ready: boolean; standings: { name: string; points: number }[];
}

const messages: Record<string, readonly [string, string, string]> = {
  account_required: ["Для участия войдите в аккаунт.", "Sign in to participate.", "Inicia sesión para participar."],
  owner_required: ["Управлять ареной может организатор.", "Only the organizer can manage this arena.", "Solo el organizador puede gestionar esta arena."],
  arena_missing: ["Арена не найдена.", "Arena not found.", "No se encontró la arena."],
  registration_closed: ["Регистрация завершена.", "Registration has closed.", "La inscripción está cerrada."],
  registration_required: ["Для подбора требуется регистрация на арене.", "Register for the arena before joining the queue.", "Inscríbete en la arena antes de buscar rival."],
  arena_closed: ["Подбор сейчас закрыт.", "Pairing is closed.", "Los emparejamientos están cerrados."],
  need_two_players: ["Для старта нужны два участника.", "Two players must register before the arena can start.", "Se necesitan dos participantes para iniciar la arena."],
  already_playing: ["У вас уже идёт турнирная партия.", "You already have an arena game in progress.", "Ya tienes una partida de arena en curso."],
  empty_name: ["Введите название арены.", "Enter an arena name.", "Escribe un nombre para la arena."],
  invalid: ["Некорректный ответ арены.", "Invalid arena response.", "La respuesta de la arena no es válida."],
  invalid_list: ["Некорректный список арен.", "Invalid arena list.", "La lista de arenas no es válida."],
};

function errorText(key: string, t: (ru: string, en: string, es: string) => string) {
  const translation = Object.prototype.hasOwnProperty.call(messages, key) && messages[key];
  return translation ? t(...translation) : t("Не удалось выполнить запрос.", "Could not complete the request.", "No se pudo completar la solicitud.");
}

function ArenaCountdown({ ends }: { ends: number }) {
  const { t, language } = useLanguage();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, Math.ceil((ends - now) / 1000));
  return <div><strong className={styles.clock} role="timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</strong>
    <span className="atlas-muted">{t("До конца арены", "Time remaining", "Tiempo restante")} · {new Date(ends).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })}</span></div>;
}

async function request(path: string, options?: RequestInit) {
  const response = await fetch("/api/arenas" + path, { cache: "no-store", ...options });
  if (!response.ok) {
    const { detail } = await response.json();
    throw Error(typeof detail === "string" ? detail : "request");
  }
  return response.json();
}

function ArenaRoom({ id }: { id: string }) {
  const { language, t } = useLanguage();
  const [arena, setArena] = useState<Arena>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refresh, update] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const data = await request("/" + id, { signal: abort.signal });
        if (!data || typeof data.name !== "string" || !Array.isArray(data.players) ||
          !data.players.every((p: unknown) => typeof p === "string") ||
          !["registration", "playing", "finishing", "finished"].includes(data.phase) ||
          !(data.game === null || /^[a-f0-9]{32}$/.test(data.game)) || !Number.isSafeInteger(data.played) ||
          !(data.ends === null || Number.isSafeInteger(data.ends)) || !Array.isArray(data.standings) ||
          !data.standings.every((r: { name: string; points: number }) => r && typeof r.name === "string" && Number.isSafeInteger(r.points)) ||
          ![data.ready, data.joined, data.owner, data.signed_in].every(flag => typeof flag === "boolean")) throw Error("invalid");
        if (!abort.signal.aborted) { setArena(data); setLoadError(""); }
      } catch (e) { if (!abort.signal.aborted) setLoadError((e as Error).message); }
      if (!abort.signal.aborted) timer = setTimeout(load, 2500);
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [id, refresh]);
  async function act(action: string) {
    setBusy(true); setError("");
    try {
      await request("/" + id + "/" + action, { method: "POST" });
      update(n => n + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const registration = arena?.phase === "registration";
  const final = arena?.phase === "finished";
  return <main lang={language} className="atlas-page"><h1>{arena?.name ?? t("Турнирная арена", "Tournament arena", "Arena de torneo")}</h1>
    {(loadError || error) && <p role="alert">{errorText(loadError || error, t)}</p>}
    <div className="atlas-columns">
      <section className="atlas-card">
        {arena ? <><h2>{registration ? t("Регистрация открыта", "Registration is open", "Inscripción abierta") : final ? t("Арена завершена", "Arena finished", "Arena finalizada") : t("Арена идёт", "Arena in progress", "Arena en curso")}</h2>
          <p className="atlas-muted">{t("Блиц 5+3", "Blitz 5+3", "Blitz 5+3")} · {t("30 минут", "30 minutes", "30 minutos")}</p>
          {registration ? <><h3>{t("Участники", "Players", "Participantes")} ({arena.players.length})</h3>
            <ol className={styles.list}>{arena.players.map(p => <li key={p}><strong>{p}</strong></li>)}</ol></> :
            <><h3>{final ? t("Итоговая таблица", "Final standings", "Clasificación final") : t("Турнирная таблица", "Standings", "Clasificación")}</h3>
            <div className={styles.scrollTable}><table><thead><tr><th>{t("Место", "Place", "Puesto")}</th><th>{t("Игрок", "Player", "Jugador")}</th><th>{t("Очки", "Points", "Puntos")}</th></tr></thead>
              <tbody>{arena.standings.map((row, index) => <tr key={row.name}><td>{index + 1}</td><td>{row.name}</td><td>{row.points}</td></tr>)}</tbody></table></div></>}
        </> : !loadError && <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p>}
      </section>
      <aside className="atlas-card"><h2>{registration ? t("Регистрация", "Registration", "Inscripción") : final ? t("Итог арены", "Arena result", "Resultado de la arena") : t("Ваша партия", "Your game", "Tu partida")}</h2>
        {arena && <div className={styles.stack}>
          {registration && <><div><strong className={styles.clock}>30:00</strong><span className="atlas-muted">{t("Продолжительность", "Duration", "Duración")}</span></div>
            {arena.signed_in ? <button className="atlas-primary" disabled={busy} onClick={() => act(arena.joined ? "leave" : "join")}>
              {arena.joined ? t("Отменить регистрацию", "Withdraw registration", "Cancelar inscripción") : t("Зарегистрироваться на арену", "Register for arena", "Inscribirse en la arena")}</button> : <a className="atlas-primary" href="?section=profile&view=account#account">{t("Войти для участия", "Sign in to participate", "Inicia sesión para participar")}</a>}
            {arena.owner && <button disabled={busy || arena.players.length < 2} onClick={() => act("play/start")}>{t("Начать арену на 30 минут", "Start 30-minute arena", "Iniciar arena de 30 minutos")}</button>}
          </>}
          {arena.phase === "playing" && <>
            {arena.ends !== null && <ArenaCountdown ends={arena.ends} />}
            {arena.joined && !arena.game && <button className="atlas-primary" disabled={busy} onClick={() => act("play/" + (arena.ready ? "pause" : "ready") + "?played=" + arena.played)}>
              {arena.ready ? t("Отменить ожидание", "Leave queue", "Salir de la cola") : t("Готов к партии", "Ready to play", "Buscar rival")}</button>}
            {arena.owner && <ConfirmAction disabled={busy} label={t("Завершить арену", "Finish arena", "Finalizar arena")}
              question={t(`Завершить арену «${arena.name}»?`, `Finish “${arena.name}”?`, `¿Finalizar «${arena.name}»?`)}
              description={t("Игроки смогут закончить текущие партии. Новые пары создаваться не будут.", "Players can finish their current games. Pairing will stop.", "Los jugadores podrán terminar sus partidas en curso. Se cerrarán los emparejamientos.")}
              onConfirm={() => act("play/finish")} />}
          </>}
          {arena.phase === "finishing" && <p>{t("Идут последние партии", "Final games in progress", "Las últimas partidas siguen en juego")}</p>}
          {arena.game && <a className="atlas-primary" href={"?game=" + arena.game}>{t("Открыть турнирную партию", "Open arena game", "Abrir partida de la arena")}</a>}
          {final && arena.standings.length > 0 && <div><span className="atlas-muted">{t("Лучший результат", "Top score", "Mejor puntuación")}</span>
            <strong className={styles.clock}>{arena.standings[0].points}</strong>
            <p>{arena.standings.filter(player => player.points === arena.standings[0].points).map(player => player.name).join(", ")}</p></div>}
        </div>}
        <a className={styles.rowLink} href="?section=arenas">{t("Все арены", "All arenas", "Todas las arenas")}</a>
      </aside>
    </div>
  </main>;
}

export function ArenasPage() {
  const id = new URLSearchParams(location.search).get("arena");
  return id ? <ArenaRoom id={id} /> : <ArenaList />;
}

function ArenaList() {
  const { language, t } = useLanguage();
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const [name, setName] = useState("");
  const [id] = useState(commandId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    request("?offset=" + offset, { signal: abort.signal }).then(data => {
      if (!Array.isArray(data?.items) || typeof data.more !== "boolean" ||
        !data.items.every((r: { id: string; name: string }) => r && typeof r.name === "string" && /^[a-f0-9]{32}$/.test(r.id))) throw Error("invalid_list");
      if (!abort.signal.aborted) { setRows(data.items); setMore(data.more); setLoaded(true); }
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [offset]);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await request("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) });
      location.assign(arenaUrl(id));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main lang={language} className="atlas-page"><h1>{t("Турнирные арены", "Tournament arenas", "Torneos de arena")}</h1>
    {error && <p role="alert">{errorText(error, t)} <a href="?section=profile">{t("Профиль", "Profile", "Perfil")}</a></p>}
    <div className="atlas-columns">
      <section className="atlas-card"><h2>{t("Арены клуба", "Club arenas", "Arenas del club")}</h2>
        {!loaded && !error && <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p>}
        {loaded && !rows.length && <p className="atlas-muted">{t("Арен пока нет.", "No arenas yet.", "Todavía no hay arenas.")}</p>}
        <ul className={styles.list}>{rows.map(row => <li key={row.id}><a className={styles.rowLink} href={arenaUrl(row.id)}>{row.name}</a></li>)}</ul>
        <div className={styles.actions}>{offset > 0 && <button onClick={() => setOffset(offset - 20)}>{t("Предыдущие арены", "Previous arenas", "Arenas anteriores")}</button>}
        {more && <button onClick={() => setOffset(offset + 20)}>{t("Следующие арены", "Next arenas", "Arenas siguientes")}</button>}</div>
      </section>
      <section className="atlas-card"><h2>{t("Новая арена", "New arena", "Nueva arena")}</h2>
        <form className={styles.form} onSubmit={create}><label>{t("Название арены", "Arena name", "Nombre de la arena")} <input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
          <button className="atlas-primary" disabled={busy || !name.trim()}>{t("Создать арену", "Create arena", "Crear arena")}</button></form>
      </section>
    </div>
  </main>;
}
