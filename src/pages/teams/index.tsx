import React, { useEffect, useRef, useState } from "react";
import { commandId } from "../../shared/commandId";

interface Member { name: string; joined: boolean }
interface Team { id: string; name: string; owner: boolean; joined: boolean; members: Member[] }

export function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>();
  const [guest, setGuest] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const nextId = useRef("");
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch("/api/teams", { signal: abort.signal, cache: "no-store" });
        if (response.status === 403) {
          if (!abort.signal.aborted) { setGuest(true); setTeams(undefined); }
          return;
        }
        if (!response.ok) throw Error();
        const rows = await response.json();
        if (!Array.isArray(rows) || !rows.every((t: Team) => t && /^[a-f0-9]{32}$/.test(t.id) && typeof t.name === "string" &&
          typeof t.joined === "boolean" && typeof t.owner === "boolean" && Array.isArray(t.members) &&
          t.members.every(m => m && typeof m.name === "string" && typeof m.joined === "boolean"))) throw Error();
        if (!abort.signal.aborted) { setTeams(rows); setLoadError(false); setGuest(false); }
      } catch { if (!abort.signal.aborted) setLoadError(true); }
      if (!abort.signal.aborted) timer = setTimeout(load, 3000);
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [revision]);

  async function send(path: string, body?: object) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/teams" + path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}) });
      if (!response.ok) {
        const data = await response.json();
        throw Error(data.detail === "unknown_player" ? "Игрок с таким именем не найден." : "Изменение не сохранено. Проверьте данные и повторите попытку.");
      }
      refresh(n => n + 1);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка соединения."); return false; }
    finally { setBusy(false); }
  }

  return <main className="study-page"><h1>Команды</h1>
    {guest ? <a href="?section=profile">Войти для участия</a> : teams && <>
      <form onSubmit={async e => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!nextId.current) nextId.current = commandId();
        if (await send("", { id: nextId.current, name: new FormData(form).get("name") })) { nextId.current = ""; form.reset(); }
      }}><label>Название команды <input name="name" required maxLength={80} /></label><button disabled={busy}>Создать команду</button></form>
      {!teams.length && <p>У вас пока нет команд и приглашений.</p>}
      {teams.map(team => <section key={team.id}><h2>{team.name}</h2>
        {team.joined ? <><ul>{team.members.map(m => <li key={m.name}>{m.name}{!m.joined && " · Приглашение отправлено"}</li>)}</ul>
          {team.owner && <form onSubmit={async e => {
            e.preventDefault(); const form = e.currentTarget;
            if (await send("/" + team.id + "/invite", { name: new FormData(form).get("player") })) form.reset();
          }}><label>Имя игрока <input required name="player" maxLength={32} /></label><button disabled={busy}>Пригласить в команду</button></form>}
        </> : <><p>Вас пригласили в команду.</p><button disabled={busy} onClick={() => send("/" + team.id + "/accept")}>Принять приглашение</button>
          <button disabled={busy} onClick={() => send("/" + team.id + "/decline")}>Отклонить приглашение</button></>}
      </section>)}
    </>}
    {loadError && <p role="alert">Не удалось загрузить команды. <button onClick={() => refresh(n => n + 1)}>Повторить</button></p>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
