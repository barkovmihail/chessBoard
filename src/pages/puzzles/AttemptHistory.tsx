import React, { useEffect, useState } from "react";

interface Entry { id: string; puzzle: string; started: number; mistakes: number; solved: boolean }

export function AttemptHistory({ revision }: { revision: number }) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{ items: Entry[]; more: boolean }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setError(false);
    setPage(undefined);
    fetch("/api/puzzles/attempts?offset=" + offset, { signal: abort.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (typeof data.more !== "boolean" || !Array.isArray(data.items) ||
            !data.items.every((row: Entry) => row && typeof row.id === "string" && typeof row.puzzle === "string" &&
              Number.isSafeInteger(row.started) && Number.isSafeInteger(row.mistakes) && typeof row.solved === "boolean")) throw Error();
        if (!abort.signal.aborted) setPage(data);
      }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [open, offset, revision, retry]);
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>История попыток</summary>
    {open && (error ? <button onClick={() => setRetry(retry + 1)}>Повторить загрузку истории</button> : !page ?
      <p>Загружаем историю…</p> : <>
        {!page.items.length && <p>Пока нет попыток.</p>}
        <ol>{page.items.map(row => <li key={row.id}>Задача {row.puzzle} · {row.solved ? "Решена" : "Не завершена"} · Ошибок {row.mistakes} · {new Date(row.started).toLocaleString("ru-RU")}</li>)}</ol>
        {offset > 0 && <button onClick={() => setOffset(offset - 20)}>Предыдущие попытки</button>}
        {page.more && <button onClick={() => setOffset(offset + 20)}>Следующие попытки</button>}
      </>)}
  </details>;
}
