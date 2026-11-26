import { useLanguage } from "../../shared/language";
import React, { useEffect, useRef, useState } from "react";
import { commandId } from "../../shared/commandId";
import { panelStyles as styles } from "../../shared/page-panels";

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

  const memberships = teams?.filter(team => team.joined);
  const invitations = teams?.filter(team => !team.joined);
  return <main lang={language} className="atlas-page"><h1>{t("Команды", "Teams", "Equipos")}</h1>
    {loadError && <p role="alert">{t("Не удалось загрузить команды.", "Could not load teams.", "No se pudieron cargar los equipos.")} <button onClick={() => refresh(n => n + 1)}>{t("Повторить", "Retry", "Reintentar")}</button></p>}
    {error && <p role="alert">{error === "invite" ? t("Приглашение этому игроку недоступно.", "This player cannot be invited.", "No se puede invitar a este jugador.") :
      error === "player" ? t("Игрок с таким именем не найден.", "Player not found.", "No se encontró al jugador.") :
      error === "save" ? t("Изменение не сохранено. Проверьте данные и повторите попытку.", "Could not save changes. Check the details and try again.", "No se pudieron guardar los cambios. Revisa los datos y vuelve a intentarlo.") :
      t("Ошибка соединения.", "Connection error.", "Error de conexión.")}</p>}
    <div className="atlas-columns">
      <div className={styles.stack}>
        {!memberships?.length && <section className="atlas-card"><h2>{t("Мои команды", "My teams", "Mis equipos")}</h2>
          {guest ? <a className="atlas-primary" href="?section=profile&view=account#account">{t("Войти для участия", "Sign in to participate", "Inicia sesión para participar")}</a> :
            teams ? <p className="atlas-muted">{teams.length ? t("Вы пока не состоите в командах.", "You haven't joined a team yet.", "Todavía no perteneces a ningún equipo.") : t("У вас пока нет команд и приглашений.", "You have no teams or invitations yet.", "Todavía no tienes equipos ni invitaciones.")}</p> :
            !loadError && <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p>}
        </section>}
        {memberships?.map(team => <section key={team.id} className="atlas-card"><h2>{team.name}</h2>
          <h3>{t("Участники команды", "Team members", "Miembros del equipo")}</h3>
          <ul className={styles.list}>{team.members.map(m => <li key={m.name}><strong>{m.name}</strong>{!m.joined && t(" · Приглашение отправлено", " · Invited", " · Invitación enviada")}</li>)}</ul>
          {team.owner && <form className={styles.form} onSubmit={async e => {
            e.preventDefault(); const form = e.currentTarget;
            if (await send("/" + team.id + "/invite", { name: new FormData(form).get("player") })) form.reset();
          }}><label>{t("Имя игрока", "Player name", "Nombre del jugador")} <input required name="player" maxLength={32} /></label><button className="atlas-primary" disabled={busy}>{t("Пригласить в команду", "Invite to team", "Invitar al equipo")}</button></form>}
        </section>)}
      </div>
      <aside className={styles.stack}><section className="atlas-card"><h2>{t("Управление командой", "Team management", "Gestión del equipo")}</h2>
        <form className={styles.form} onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget;
          if (!nextId.current) nextId.current = commandId();
          if (await send("", { id: nextId.current, name: new FormData(form).get("name") })) { nextId.current = ""; form.reset(); }
        }}><fieldset disabled={busy || !teams}><label>{t("Название команды", "Team name", "Nombre del equipo")} <input name="name" required maxLength={80} /></label>
          <button className="atlas-primary">{t("Создать команду", "Create team", "Crear equipo")}</button></fieldset></form>
      </section>
      {!!invitations?.length && <section className="atlas-card"><h2>{t("Приглашения", "Invitations", "Invitaciones")}</h2>
        {invitations.map(team => <section key={team.id}><h3>{team.name}</h3><p>{t("Приглашает", "Invited by", "Invitación de")} {team.sender}.</p>
          <div className={styles.stack}><button className="atlas-primary" disabled={busy} onClick={() => send("/" + team.id + "/accept")}>{t("Принять приглашение", "Accept invitation", "Aceptar invitación")}</button>
            <button disabled={busy} onClick={() => send("/" + team.id + "/decline")}>{t("Отклонить приглашение", "Decline invitation", "Rechazar invitación")}</button>
            <button disabled={busy} onClick={() => send("/blocks/block", { name: team.sender })}>{t("Отключить приглашения от", "Block invitations from", "Bloquear invitaciones de")} {team.sender}</button>
          </div></section>)}</section>}
      {blocked.length > 0 && <section className="atlas-card"><h2>{t("Приглашения отключены", "Blocked invitations", "Invitaciones bloqueadas")}</h2><ul className={styles.list}>{blocked.map(name =>
        <li key={name}>{name} <button disabled={busy} onClick={() => send("/blocks/unblock", { name })}>{t("Разрешить приглашения от", "Allow invitations from", "Permitir invitaciones de")} {name}</button></li>)}</ul></section>}
      </aside>
    </div>
  </main>;
}
