import { useLanguage } from "../shared/language";
import React, { useEffect, useState } from "react";
import { commandId } from "../shared/commandId";

const errors = {
  invalid_opponent: ["Введите имя другого зарегистрированного игрока.", "Enter another registered player’s name.", "Introduce el nombre de otro jugador registrado."],
  already_challenged: ["У этого игрока уже есть ваш вызов.", "You already challenged this player.", "Ya has desafiado a este jugador."],
  failed: ["Не удалось выполнить действие.", "Could not complete the action.", "No se pudo completar la acción."],
  expired: ["Срок вызова истёк.", "This challenge has expired.", "El desafío ha caducado."],
  canceled: ["Вызов отменён.", "This challenge was canceled.", "Se ha cancelado el desafío."],
  offline: ["Связь потеряна. Проверьте список вызовов.", "Connection lost. Check the challenge list.", "Se ha perdido la conexión. Consulta la lista de desafíos."],
} as const;

interface Entry {
  id: string; opponent: string; incoming: boolean; minutes: number; increment: number;
}

function validChallenge(x: Omit<Entry, "incoming">) {
  return x && typeof x.id === "string" && typeof x.opponent === "string" &&
    Number.isInteger(x.minutes) && Number.isInteger(x.increment);
}

export function Challenges({ open, count }: { open: boolean; count: (n: number) => void }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<Entry[]>([]);
  const [expired, setExpired] = useState<Omit<Entry, "incoming">[]>([]);
  const [member, setMember] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof errors | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch(open ? "/api/challenges?include_expired=true" : "/api/challenges", { signal: abort.signal, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || typeof data.member !== "boolean" || !Array.isArray(data.items) ||
          !data.items.every((x: Entry) => validChallenge(x) && typeof x.incoming === "boolean") ||
          !Array.isArray(data.expired) || !data.expired.every(validChallenge)) throw Error();
        if (abort.signal.aborted) return;
        setMember(data.member);
        setItems(data.items);
        setExpired(data.expired);
        count(data.items.filter((x: Entry) => x.incoming).length);
        setOffline(false);
      } catch { if (!abort.signal.aborted) setOffline(true); }
      if (!abort.signal.aborted) timer = setTimeout(load, open ? 3000 : 12000);
    }
    void load();
    return () => { abort.abort(); clearTimeout(timer); };
  }, [open, refresh, count]);

  async function send(path: string, body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges" + path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: body && JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail === "invalid_opponent" ? "invalid_opponent" :
          data.detail === "already_challenged" ? "already_challenged" : "failed");
      } else if (typeof data.game_id === "string") location.assign("?game=" + encodeURIComponent(data.game_id));
      else if (data.status === "expired") setError("expired");
      else if (data.status === "canceled" && !path.endsWith("/cancel")) setError("canceled");
    } catch { setError("offline"); }
    finally { setBusy(false); setRefresh(n => n + 1); }
  }
  return <>
    {offline && <p role="alert">{t("Не удалось обновить вызовы.", "Could not refresh challenges.", "No se pudieron actualizar los desafíos.")}</p>}
    {[true, false].map(incoming => {
      const rows = items.filter(x => x.incoming === incoming);
      if (!incoming && !rows.length) return null;
      return <div key={String(incoming)}><h3>{incoming ? t("Входящие вызовы", "Incoming challenges", "Desafíos recibidos") : t("Исходящие вызовы", "Outgoing challenges", "Desafíos enviados")}</h3>
        {!rows.length && <p>{t("Нет вызовов", "No challenges", "No hay desafíos")}</p>}
        {rows.map(x => <div key={x.id}><strong>{x.opponent}</strong> · {x.minutes}+{x.increment} · {incoming ? t("Вы играете чёрными", "You play Black", "Juegas con negras") : t("Вы играете белыми", "You play White", "Juegas con blancas")}
          {incoming ? <><button disabled={busy} onClick={() => send("/" + x.id + "/accept")}>{t("Принять вызов", "Accept challenge", "Aceptar desafío")}</button>
            <button disabled={busy} onClick={() => send("/" + x.id + "/decline")}>{t("Отклонить", "Decline", "Rechazar")}</button></> :
            <button disabled={busy} onClick={() => send("/" + x.id + "/cancel")}>{t("Отменить вызов", "Cancel challenge", "Cancelar desafío")}</button>}
        </div>)}
      </div>;
    })}
    {expired.length > 0 && <details><summary>{t("Истёкшие входящие вызовы", "Expired incoming challenges", "Desafíos recibidos caducados")}</summary>
      <ul>{expired.map(x => <li key={x.id}>{x.opponent} · {x.minutes}+{x.increment} · {t("Срок истёк", "Expired", "Caducado")}</li>)}</ul>
    </details>}
    {member && <a href="?section=messages">{t("Личные сообщения", "Private messages", "Mensajes privados")}</a>}
    {member && <form onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void send("", { name: form.get("name"), command_id: commandId(),
        control: { minutes: Number(form.get("minutes")), increment: Number(form.get("increment")) } });
    }}>
      <fieldset disabled={busy}><legend>{t("Вызвать на партию", "Challenge a player", "Desafiar a un jugador")}</legend>
        <label>{t("Имя соперника", "Opponent’s username", "Nombre de usuario del rival")} <input required name="name" pattern="[a-zA-Z0-9_]{3,32}" /></label>
        <label>{t("Минуты", "Minutes", "Minutos")} <input required name="minutes" type="number" min="1" max="1440" defaultValue="5" /></label>
        <label>{t("Добавка, с", "Increment, seconds", "Incremento en segundos")} <input required name="increment" type="number" min="0" max="3600" defaultValue="3" /></label>
        <button>{t("Отправить вызов", "Send challenge", "Enviar desafío")}</button>
      </fieldset>
    </form>}
    {error && <p role="alert">{t(errors[error][0], errors[error][1], errors[error][2])}</p>}
  </>;
}
