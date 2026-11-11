import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { commandId } from "../../shared/commandId";

interface Member { name: string; joined: boolean }
interface Team { id: string; name: string; owner: boolean; sender: string; joined: boolean; members: Member[] }

export function TeamsPage() {
  const { language, t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>();
  const [blocked, setBlocked] = useState<string[]>([]);
  const [guest, setGuest] = useState(false);
  const [error, setError] = useState<"invite" | "player" | "save" | "network" | null>(null);
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
          typeof t.sender === "string" && typeof t.joined === "boolean" && typeof t.owner === "boolean" && Array.isArray(t.members) &&
          t.members.every(m => m && typeof m.name === "string" && typeof m.joined === "boolean"))) throw Error();
        const blockResponse = await fetch("/api/teams/blocks", { signal: abort.signal, cache: "no-store" });
        if (!blockResponse.ok) throw Error();
        const names = await blockResponse.json();
        if (!Array.isArray(names) || !names.every(n => typeof n === "string")) throw Error();
        if (!abort.signal.aborted) { setBlocked(names); setTeams(rows); setLoadError(false); setGuest(false); }
      } catch { if (!abort.signal.aborted) setLoadError(true); }
      if (!abort.signal.aborted) timer = setTimeout(load, 3000);
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [revision]);

  async function send(path: string, body?: object) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/teams" + path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}) });
      if (!response.ok) {
        const data = await response.json();
        setError(data.detail === "invite_unavailable" ? "invite" : data.detail === "unknown_player" ? "player" : "save");
        return false;
      }
      refresh(n => n + 1);
      return true;
    } catch { setError("network"); return false; }
    finally { setBusy(false); }
  }

  return <main lang={language} className="study-page"><h1>{t("Команды", "Teams")}</h1>
    {guest ? <a href="?section=profile">{t("Войти для участия", "Sign in to participate")}</a> : teams && <>
      <form onSubmit={async e => {
        e.preventDefault();
        const form = e.currentTarget;
        if (!nextId.current) nextId.current = commandId();
        if (await send("", { id: nextId.current, name: new FormData(form).get("name") })) { nextId.current = ""; form.reset(); }
      }}><label>{t("Название команды", "Team name")} <input name="name" required maxLength={80} /></label><button disabled={busy}>{t("Создать команду", "Create team")}</button></form>
      {!teams.length && <p>{t("У вас пока нет команд и приглашений.", "You have no teams or invitations yet.")}</p>}
      {teams.map(team => <section key={team.id}><h2>{team.name}</h2>
        {team.joined ? <><ul>{team.members.map(m => <li key={m.name}>{m.name}{!m.joined && t(" · Приглашение отправлено", " · Invited")}</li>)}</ul>
          {team.owner && <form onSubmit={async e => {
            e.preventDefault(); const form = e.currentTarget;
            if (await send("/" + team.id + "/invite", { name: new FormData(form).get("player") })) form.reset();
          }}><label>{t("Имя игрока", "Player name")} <input required name="player" maxLength={32} /></label><button disabled={busy}>{t("Пригласить в команду", "Invite to team")}</button></form>}
        </> : <><p>{t("Приглашает", "Invited by")} {team.sender}.</p><button disabled={busy} onClick={() => send("/" + team.id + "/accept")}>{t("Принять приглашение", "Accept invitation")}</button>
          <button disabled={busy} onClick={() => send("/" + team.id + "/decline")}>{t("Отклонить приглашение", "Decline invitation")}</button>
          <button disabled={busy} onClick={() => send("/blocks/block", { name: team.sender })}>{t("Отключить приглашения от", "Block invitations from")} {team.sender}</button></>}
      </section>)}
      {blocked.length > 0 && <section><h2>{t("Приглашения отключены", "Blocked invitations")}</h2><ul>{blocked.map(name =>
        <li key={name}>{name} <button disabled={busy} onClick={() => send("/blocks/unblock", { name })}>{t("Разрешить приглашения от", "Allow invitations from")} {name}</button></li>
      )}</ul></section>}
    </>}
    {loadError && <p role="alert">{t("Не удалось загрузить команды.", "Could not load teams.")} <button onClick={() => refresh(n => n + 1)}>{t("Повторить", "Retry")}</button></p>}
    {error && <p role="alert">{error === "invite" ? t("Приглашение этому игроку недоступно.", "This player cannot be invited.") :
      error === "player" ? t("Игрок с таким именем не найден.", "Player not found.") :
      error === "save" ? t("Изменение не сохранено. Проверьте данные и повторите попытку.", "Could not save changes. Check the details and try again.") :
      t("Ошибка соединения.", "Connection error.")}</p>}
  </main>;
}
