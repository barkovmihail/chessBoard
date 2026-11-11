import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { Account } from "./Account";
import { resultReason } from "../../features/play";

interface Entry {
  id: string;
  opponent: string | null;
  side: "white" | "black" | "both";
  result: string;
  reason: string;
  base_minutes: number | null;
  increment_seconds: number | null;
  finished_ms: number | null;
}

function validEntry(row: Entry) {
  return row && typeof row.id === "string" && (row.opponent === null || typeof row.opponent === "string") && ["white", "black", "both"].includes(row.side) &&
    typeof row.result === "string" && typeof row.reason === "string" &&
    [row.finished_ms, row.base_minutes, row.increment_seconds].every(n => n === null || Number.isSafeInteger(n));
}

export function ProfilePage({ onInbox }: { onInbox: () => void }) {
  const { language, t } = useLanguage();
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{items: Entry[]; next_offset: number | null}>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setPage(undefined);
    setError(false);
    fetch("/api/profile/games?offset=" + offset, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!Array.isArray(data.items) || !data.items.every(validEntry) ||
          !(data.next_offset === null || Number.isSafeInteger(data.next_offset))) throw Error();
      if (!abort.signal.aborted) setPage(data);
    }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [offset, retry]);
  return <main lang={language}><h1>{t("Профиль", "Profile")}</h1><Account /><a href="?section=teams">{t("Команды", "Teams")}</a> <button onClick={onInbox}>{t("Входящие", "Inbox")}</button><h2>{t("История игр", "Game history")}</h2>
    {error ? <p role="alert">{t("Не удалось загрузить партии.", "Could not load games.")} <button onClick={() => setRetry(retry + 1)}>{t("Повторить", "Retry")}</button></p> :
      !page ? <p>{t("Загрузка…", "Loading\u2026")}</p> : <>
        {!page.items.length && <p>{t("Завершённых партий пока нет", "No finished games yet")}</p>}
        <ul>{page.items.map(game => <li key={game.id}><a href={"?game=" + encodeURIComponent(game.id)}>
          {game.finished_ms === null ? t("Дата неизвестна", "Unknown date") : new Date(game.finished_ms).toLocaleString(language)} · {
          game.side === "both" ? t("На одном устройстве", "On one device") : (game.opponent ?? t("Гость", "Guest")) + " · " + (game.side === "white" ? t("Вы играли белыми", "You played White") : t("Вы играли чёрными", "You played Black"))} · {
          game.base_minutes === null ? t("Без часов", "Unlimited") : game.base_minutes + "+" + game.increment_seconds} · {
          game.result} · {resultReason(game.reason, language)}</a></li>)}</ul>
        {offset > 0 && <button onClick={() => setOffset(Math.max(0, offset - 20))}>{t("Предыдущая страница", "Previous page")}</button>}
        {page.next_offset !== null && <button onClick={() => setOffset(page.next_offset!)}>{t("Следующая страница", "Next page")}</button>}
      </>}
  </main>;
}
