import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { commandId } from "../../shared/commandId";

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
  return <main lang={language} className="study-page"><a href="?section=arenas">{t("Все арены", "All arenas", "Todas las arenas")}</a>
    <h1>{arena?.name ?? t("Турнирная арена", "Tournament arena", "Arena de torneo")}</h1>{(loadError || error) && <p role="alert">{errorText(loadError || error, t)}</p>}
    {arena && <><p>{t("Блиц 5+3", "Blitz 5+3", "Blitz 5+3")}</p>
      {arena.phase === "registration" && <>
        {arena.signed_in ? <button disabled={busy} onClick={() => act(arena.joined ? "leave" : "join")}>
          {arena.joined ? t("Отменить регистрацию", "Withdraw registration", "Cancelar inscripción") : t("Зарегистрироваться на арену", "Register for arena", "Inscribirse en la arena")}</button> : <a href="?section=profile">{t("Войти для участия", "Sign in to participate", "Inicia sesión para participar")}</a>}
        {arena.owner && <button disabled={busy || arena.players.length < 2} onClick={() => act("play/start")}>{t("Начать арену на 30 минут", "Start 30-minute arena", "Iniciar arena de 30 minutos")}</button>}
        <h2>{t("Участники", "Players", "Participantes")} ({arena.players.length})</h2><ul>{arena.players.map(p => <li key={p}>{p}</li>)}</ul>
      </>}
      {arena.phase === "playing" && <>
        <p>{t("Арена идёт до", "Arena ends at", "La arena termina a las")} {new Date(arena.ends!).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })}</p>
        {arena.joined && !arena.game && <button disabled={busy} onClick={() => act("play/" + (arena.ready ? "pause" : "ready") + "?played=" + arena.played)}>
          {arena.ready ? t("Отменить ожидание", "Leave queue", "Salir de la cola") : t("Готов к партии", "Ready to play", "Buscar rival")}</button>}
        {arena.owner && <button disabled={busy} onClick={() => act("play/finish")}>{t("Завершить арену", "Finish arena", "Finalizar arena")}</button>}
      </>}
      {arena.game && <a href={"?game=" + arena.game}>{t("Открыть турнирную партию", "Open arena game", "Abrir partida de la arena")}</a>}
      {arena.phase === "finishing" && <p>{t("Идут последние партии", "Final games in progress", "Las últimas partidas siguen en juego")}</p>}
      {arena.phase !== "registration" && <>
        <h2>{arena.phase === "finished" ? t("Итоговая таблица", "Final standings", "Clasificación final") : t("Турнирная таблица", "Standings", "Clasificación")}</h2>
        <table><thead><tr><th>{t("Игрок", "Player", "Jugador")}</th><th>{t("Очки", "Points", "Puntos")}</th></tr></thead><tbody>{arena.standings.map(row =>
          <tr key={row.name}><td>{row.name}</td><td>{row.points}</td></tr>)}</tbody></table>
      </>}
    </>}</main>;
}

export function ArenasPage() {
  const id = new URLSearchParams(location.search).get("arena");
  return id ? <ArenaRoom id={id} /> : <ArenaList />;
}

function ArenaList() {
  const { language, t } = useLanguage();
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
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
      if (!abort.signal.aborted) { setRows(data.items); setMore(data.more); }
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
  return <main lang={language} className="study-page"><h1>{t("Турнирные арены", "Tournament arenas", "Torneos de arena")}</h1>
    <form onSubmit={create}><label>{t("Название арены", "Arena name", "Nombre de la arena")} <input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <button disabled={busy || !name.trim()}>{t("Создать арену", "Create arena", "Crear arena")}</button></form>
    {error && <p role="alert">{errorText(error, t)} <a href="?section=profile">{t("Профиль", "Profile", "Perfil")}</a></p>}
    <ul>{rows.map(row => <li key={row.id}><a href={arenaUrl(row.id)}>{row.name}</a></li>)}</ul>
    {offset > 0 && <button onClick={() => setOffset(offset - 20)}>{t("Предыдущие арены", "Previous arenas", "Arenas anteriores")}</button>}
    {more && <button onClick={() => setOffset(offset + 20)}>{t("Следующие арены", "Next arenas", "Arenas siguientes")}</button>}
  </main>;
}
