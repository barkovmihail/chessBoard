import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";

const errors = {
  check: ["Не удалось проверить поиск.", "Could not check matchmaking.", "No se pudo comprobar el emparejamiento."],
  offline: ["Восстанавливаем связь с очередью…", "Reconnecting to the queue…", "Reconectando con la cola…"],
  login: ["Для рейтинговой игры войдите в профиль.", "Sign in to play a rated game.", "Inicia sesión para jugar una partida puntuada."],
  queue: ["Не удалось подтвердить поиск. Проверьте состояние очереди.", "Could not confirm the search. Check the queue status.", "No se pudo confirmar la búsqueda. Comprueba el estado de la cola."],
} as const;

interface Ticket {
  version: number;
  waiting: boolean;
  game_id: string | null;
  minutes?: number;
  increment?: number;
  rated?: boolean;
  chess960?: boolean;
}

async function queue(action = "", data?: object): Promise<Ticket> {
  const response = await fetch("/api/queue" + action, data && {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const ticket = await response.json();
  if (response.status === 403 && ticket.detail === "account_required") throw Error("account_required");
  if (!response.ok || !Number.isSafeInteger(ticket.version) || typeof ticket.waiting !== "boolean" ||
      !(ticket.game_id === null || typeof ticket.game_id === "string" && /^[a-f0-9]{32}$/.test(ticket.game_id)) ||
      (ticket.waiting && typeof ticket.chess960 !== "boolean") ||
      (ticket.waiting && ![ticket.minutes, ticket.increment].every(Number.isInteger))) throw Error();
  return ticket;
}

export function QuickGame({ control, valid, onSearching }: {
  control: { minutes: number; increment: number }; valid: boolean; onSearching: (value: boolean) => void;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("casual");
  const [ticket, setTicket] = useState<Ticket>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof errors | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => { onSearching(busy || !!ticket?.waiting); }, [busy, ticket?.waiting, onSearching]);
  useEffect(() => {
    let active = true;
    queue().then(value => { if (active) setTicket(value); })
      .catch(() => { if (active) setError("check"); });
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
        setError(null);
        if (next.game_id) location.assign("?game=" + next.game_id);
        if (!next.waiting) return;
      } catch { if (active) setError("offline"); }
      if (active) timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [ticket?.waiting, ticket?.version, busy]);

  async function change() {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    try {
      if (!ticket.waiting) await queue("/session", {});
      const next = await queue(ticket.waiting ? "/cancel" : "/start", { version: ticket.version, control, rated: mode === "rated", chess960: mode === "chess960" });
      setTicket(next);
      if (next.game_id) location.assign("?game=" + next.game_id);
    } catch (failure) {
      if (failure instanceof Error && failure.message === "account_required") {
        setError("login");
        return;
      }
      setError("queue");
      setRetry(value => value + 1);
    } finally { setBusy(false); }
  }

  return <div>
    {!ticket?.waiting && <label>{t("Режим быстрого поиска", "Quick pairing mode", "Modo de emparejamiento rápido")} <select disabled={busy} value={mode}
      onChange={event => setMode(event.target.value)}>
      <option value="casual">{t("Нерейтинговая игра", "Casual game", "Partida amistosa")}</option><option value="rated">{t("Рейтинговая игра", "Rated game", "Partida puntuada")}</option>
      <option value="chess960">{t("Chess960 · Нерейтинговая игра", "Chess960 · Casual game", "Chess960 · Partida amistosa")}</option>
    </select></label>}
    {ticket?.waiting && <p role="status">{t("Ищем соперника", "Searching for an opponent", "Buscando rival")} · {ticket.minutes}+{ticket.increment}{ticket.chess960 && " · Chess960"}{ticket.rated && t(" · Рейтинговая игра", " · Rated game", " · Partida puntuada")}</p>}
    <button disabled={!ticket || busy || (!ticket.waiting && !valid)} onClick={change}>
      {ticket?.waiting ? t("Отменить поиск", "Cancel search", "Cancelar búsqueda") : t("Найти соперника", "Find an opponent", "Buscar rival")}
    </button>
    {ticket?.game_id && <a href={"?game=" + ticket.game_id}>{t("Открыть последнюю быструю игру", "Open last quick game", "Abrir la última partida rápida")}</a>}
    {error && <p role="alert">{t(errors[error][0], errors[error][1], errors[error][2])} <button onClick={() => setRetry(value => value + 1)}>{t("Проверить", "Check", "Comprobar")}</button></p>}
  </div>;
}
