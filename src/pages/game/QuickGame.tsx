import React, { useEffect, useState } from "react";

interface Ticket {
  version: number;
  waiting: boolean;
  game_id: string | null;
  minutes?: number;
  increment?: number;
}

async function queue(action = "", data?: object): Promise<Ticket> {
  const response = await fetch("/api/queue" + action, data && {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const ticket = await response.json();
  if (!response.ok || !Number.isSafeInteger(ticket.version) || typeof ticket.waiting !== "boolean" ||
      !(ticket.game_id === null || typeof ticket.game_id === "string" && /^[a-f0-9]{32}$/.test(ticket.game_id)) ||
      (ticket.waiting && ![ticket.minutes, ticket.increment].every(Number.isInteger))) throw Error();
  return ticket;
}

export function QuickGame({ control, valid, onSearching }: {
  control: { minutes: number; increment: number }; valid: boolean; onSearching: (value: boolean) => void;
}) {
  const [ticket, setTicket] = useState<Ticket>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { onSearching(busy || !!ticket?.waiting); }, [busy, ticket?.waiting, onSearching]);
  useEffect(() => {
    let active = true;
    queue().then(value => { if (active) setTicket(value); })
      .catch(() => { if (active) setError("Не удалось проверить поиск."); });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (!ticket?.waiting || busy) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await queue("/renew", { version: ticket.version });
        if (!active) return;
        setTicket(next);
        setError("");
        if (next.game_id) location.assign("?game=" + next.game_id);
        if (!next.waiting) return;
      } catch { if (active) setError("Восстанавливаем связь с очередью…"); }
      if (active) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [ticket?.waiting, ticket?.version, busy]);

  async function change() {
    if (!ticket) return;
    setBusy(true);
    setError("");
    try {
      if (!ticket.waiting) await queue("/session", {});
      const next = await queue(ticket.waiting ? "/cancel" : "/start", { version: ticket.version, control });
      setTicket(next);
      if (next.game_id) location.assign("?game=" + next.game_id);
    } catch {
      setError("Не удалось подтвердить поиск. Проверьте состояние очереди.");
      setRetry(value => value + 1);
    } finally { setBusy(false); }
  }

  return <div>
    {ticket?.waiting && <p role="status">Ищем соперника · {ticket.minutes}+{ticket.increment}</p>}
    <button disabled={!ticket || busy || (!ticket.waiting && !valid)} onClick={change}>
      {ticket?.waiting ? "Отменить поиск" : "Найти соперника"}
    </button>
    {ticket?.game_id && <a href={"?game=" + ticket.game_id}>Открыть последнюю быструю игру</a>}
    {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Проверить</button></p>}
  </div>;
}
