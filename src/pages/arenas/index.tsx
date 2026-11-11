import React, { useEffect, useState } from "react";
import { commandId } from "../../shared/commandId";

function arenaUrl(id: string) { return "?section=arenas&arena=" + encodeURIComponent(id); }

interface Arena {
  name: string; signed_in: boolean; joined: boolean; owner: boolean; players: string[];
}

async function request(path: string, options?: RequestInit) {
  const response = await fetch("/api/arenas" + path, { cache: "no-store", ...options });
  if (!response.ok) throw Error(response.status === 403 ? "Для участия войдите в аккаунт." :
    response.status === 404 || response.status === 422 ? "Проверьте адрес или название арены." : "Не удалось выполнить запрос.");
  return response.json();
}

function ArenaRoom({ id }: { id: string }) {
  const [arena, setArena] = useState<Arena>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, update] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const data = await request("/" + id, { signal: abort.signal });
        if (!data || typeof data.name !== "string" || !Array.isArray(data.players) ||
          !data.players.every((p: unknown) => typeof p === "string") ||
          ![data.joined, data.owner, data.signed_in].every(flag => typeof flag === "boolean")) throw Error("Некорректный ответ арены.");
        if (!abort.signal.aborted) setArena(data);
      } catch (e) { if (!abort.signal.aborted) setError((e as Error).message); }
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
  return <main className="study-page"><a href="?section=arenas">Все арены</a>
    <h1>{arena?.name ?? "Турнирная арена"}</h1>{error && <p role="alert">{error}</p>}
    {arena && <><p>Блиц 5+3</p>
      {arena.signed_in ? <button disabled={busy} onClick={() => act(arena.joined ? "leave" : "join")}>
        {arena.joined ? "Отменить регистрацию" : "Зарегистрироваться на арену"}</button> : <a href="?section=profile">Войти для участия</a>}
      <h2>Участники ({arena.players.length})</h2><ul>{arena.players.map(p => <li key={p}>{p}</li>)}</ul>
    </>}</main>;
}

export function ArenasPage() {
  const id = new URLSearchParams(location.search).get("arena");
  return id ? <ArenaRoom id={id} /> : <ArenaList />;
}

function ArenaList() {
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
        !data.items.every((r: { id: string; name: string }) => r && typeof r.name === "string" && /^[a-f0-9]{32}$/.test(r.id))) throw Error("Некорректный список арен.");
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
  return <main className="study-page"><h1>Турнирные арены</h1>
    <form onSubmit={create}><label>Название арены <input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <button disabled={busy || !name.trim()}>Создать арену</button></form>
    {error && <p role="alert">{error} <a href="?section=profile">Профиль</a></p>}
    <ul>{rows.map(row => <li key={row.id}><a href={arenaUrl(row.id)}>{row.name}</a></li>)}</ul>
    {offset > 0 && <button onClick={() => setOffset(offset - 20)}>Предыдущие арены</button>}
    {more && <button onClick={() => setOffset(offset + 20)}>Следующие арены</button>}
  </main>;
}
