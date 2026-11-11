import React, { useEffect, useState } from "react";

interface Row { san: string; count: number }

export function ArchiveMoves({ prefix }: { prefix: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>Ходы из моего архива</summary>
    {open && <Results key={prefix} prefix={prefix} />}
  </details>;
}

function Results({ prefix }: { prefix: string }) {
  const [rows, setRows] = useState<Row[]>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/openings/frequencies?line=" + encodeURIComponent(prefix), { signal: abort.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!Array.isArray(data) || !data.every(row => row && typeof row.san === "string" &&
          Number.isSafeInteger(row.count) && row.count > 0)) throw Error();
        if (!abort.signal.aborted) setRows(data);
      }).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [prefix]);
  if (error) return <p role="alert">Не удалось загрузить статистику. Закройте и снова откройте список.</p>;
  if (!rows) return <p>Загрузка…</p>;
  if (!rows.length) return <p>В вашем архиве нет продолжений этой линии.</p>;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <ul>{rows.map(row => <li key={row.san}>{row.san} · {row.count} из {total} · {Math.round(100 * row.count / total)}%</li>)}</ul>;
}
