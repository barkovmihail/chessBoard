import React, { useEffect, useState } from "react";
import { commandId } from "../shared/commandId";

interface Entry {
  id: string; opponent: string; incoming: boolean; minutes: number; increment: number;
}

export function Challenges({ open, count }: { open: boolean; count: (n: number) => void }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [member, setMember] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const res = await fetch("/api/challenges", { signal: abort.signal, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || typeof data.member !== "boolean" || !Array.isArray(data.items) ||
          !data.items.every((x: Entry) => x && typeof x.id === "string" && typeof x.opponent === "string" &&
          typeof x.incoming === "boolean" && Number.isInteger(x.minutes) && Number.isInteger(x.increment))) throw Error();
        if (abort.signal.aborted) return;
        setMember(data.member);
        setItems(data.items);
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
    setError("");
    try {
      const res = await fetch("/api/challenges" + path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: body && JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail === "invalid_opponent" ? "Введите имя другого зарегистрированного игрока." :
          data.detail === "already_challenged" ? "У этого игрока уже есть ваш вызов." : "Не удалось выполнить действие.");
      } else if (typeof data.game_id === "string") location.assign("?game=" + encodeURIComponent(data.game_id));
      else if (data.status === "expired") setError("Срок вызова истёк.");
      else if (data.status === "canceled" && !path.endsWith("/cancel")) setError("Вызов отменён.");
    } catch { setError("Связь потеряна. Проверьте список вызовов."); }
    finally { setBusy(false); setRefresh(n => n + 1); }
  }
  return <>
    {offline && <p role="alert">Не удалось обновить вызовы.</p>}
    {[true, false].map(incoming => {
      const rows = items.filter(x => x.incoming === incoming);
      if (!incoming && !rows.length) return null;
      return <div key={String(incoming)}><h3>{incoming ? "Входящие вызовы" : "Исходящие вызовы"}</h3>
        {!rows.length && <p>Нет вызовов</p>}
        {rows.map(x => <div key={x.id}><strong>{x.opponent}</strong> · {x.minutes}+{x.increment} · {incoming ? "Вы играете чёрными" : "Вы играете белыми"}
          {incoming ? <><button disabled={busy} onClick={() => send("/" + x.id + "/accept")}>Принять вызов</button>
            <button disabled={busy} onClick={() => send("/" + x.id + "/decline")}>Отклонить</button></> :
            <button disabled={busy} onClick={() => send("/" + x.id + "/cancel")}>Отменить вызов</button>}
        </div>)}
      </div>;
    })}
    {member && <form onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void send("", { name: form.get("name"), command_id: commandId(),
        control: { minutes: Number(form.get("minutes")), increment: Number(form.get("increment")) } });
    }}>
      <fieldset disabled={busy}><legend>Вызвать на партию</legend>
        <label>Имя соперника <input required name="name" pattern="[a-zA-Z0-9_]{3,32}" /></label>
        <label>Минуты <input required name="minutes" type="number" min="1" max="1440" defaultValue="5" /></label>
        <label>Добавка, с <input required name="increment" type="number" min="0" max="3600" defaultValue="3" /></label>
        <button>Отправить вызов</button>
      </fieldset>
    </form>}
    {error && <p role="alert">{error}</p>}
  </>;
}
