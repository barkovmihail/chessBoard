import React, { useEffect, useState } from "react";
import { Trainer } from "../../features/training";
import { commandId } from "../../shared/commandId";

interface Chapter { name: string; side: "w" | "b"; lines: [string, string][][] }

export function ChapterEditor() {
  const [id] = useState(commandId);
  const [lines, setLines] = useState([""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const steps = lines.map(line => line.split("\n").filter(row => row.trim()).map(row => {
      const [move, ...comment] = row.split("|");
      return [move.trim(), comment.join("|").trim()];
    }));
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/studies", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: form.get("name"), side: form.get("side"), lines: steps }) });
      if (!response.ok) {
        const { detail } = await response.json();
        const invalid = typeof detail === "string" && /^invalid_move\/(\d+)\/(\d+)$/.exec(detail);
        setError(invalid ? `Вариант ${invalid[1]}, полуход ${invalid[2]}: проверьте запись хода.` :
          detail === "missing_black_move" ? "Для тренировки чёрными добавьте ответ чёрных в каждый вариант." :
          "Проверьте название и варианты. В варианте допустимо от 1 до 100 полуходов, пояснение — до 500 символов.");
        return;
      }
      const url = new URL(location.href);
      url.searchParams.set("chapter", id);
      location.assign(url);
    } catch { setError("Не удалось сохранить главу. Повторите попытку."); }
    finally { setBusy(false); }
  }
  return <main className="study-page"><h1>Новая учебная глава</h1>
    <form onSubmit={save}><fieldset disabled={busy}>
      <label>Название главы <input name="name" required maxLength={100} /></label>
      <label>Сторона игрока <select name="side"><option value="w">Белые</option><option value="b">Чёрные</option></select></label>
      <p>Начните с исходной позиции. В каждой строке запишите один полуход. После знака | можно добавить пояснение, например «e4 | Занимаем центр».</p>
      {lines.map((line, index) => <div key={index}><label htmlFor={"line-" + index}>Вариант {index + 1}</label> <textarea id={"line-" + index} required rows={5} value={line}
        onChange={e => setLines(lines.map((text, i) => i === index ? e.target.value : text))} /></div>)}
      {lines.length < 12 && <button type="button" onClick={() => setLines([...lines, ""])}>Добавить вариант</button>}
      {lines.length > 1 && <button type="button" onClick={() => setLines(lines.slice(0, -1))}>Убрать последний вариант</button>}
      <p>Сохранённая глава доступна каждому, у кого есть ссылка.</p>
      <button>Сохранить главу</button>{error && <p role="alert">{error}</p>}
    </fieldset></form></main>;
}

export function Study({ id }: { id: string }) {
  const [chapter, setChapter] = useState<Chapter>();
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/studies/" + id, { signal: abort.signal }).then(async response => {
      if (response.status === 404) { setError("Глава не найдена"); return; }
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!data || typeof data.name !== "string" || !["w", "b"].includes(data.side) ||
          !Array.isArray(data.lines) || !data.lines.length || !data.lines.every((line: unknown) =>
            Array.isArray(line) && line.length && line.every(step => Array.isArray(step) && step.length === 2 &&
              step.every(value => typeof value === "string")))) throw Error();
      if (!abort.signal.aborted) setChapter(data);
    }).catch(() => { if (!abort.signal.aborted) setError("Не удалось загрузить главу"); });
    return () => abort.abort();
  }, [id]);
  if (!chapter) return <main><p role="status">{error || "Загружаем главу…"}</p><a href="?section=openings">К дебютам</a></main>;
  return <Trainer key={index} steps={chapter.lines[index]} side={chapter.side} context={<>
    <h1>{chapter.name}</h1>
    {chapter.lines.length > 1 && <label>Учебный вариант <select value={index} onChange={e => setIndex(Number(e.target.value))}>
      {chapter.lines.map((line, i) => <option value={i} key={i}>{i + 1}. {line.slice(0, 8).map(step => step[0]).join(" ")}</option>)}
    </select></label>}
    <a href={"?section=openings&chapter=" + id}>Ссылка на главу</a>
  </>} />;
}
