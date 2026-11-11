import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { Trainer } from "../../features/training";
import { commandId } from "../../shared/commandId";

interface Chapter { name: string; side: "w" | "b"; lines: [string, string][][] }

export function ChapterEditor() {
  const { language, t } = useLanguage();
  const [id] = useState(commandId);
  const [lines, setLines] = useState([""]);
  const [error, setError] = useState<"save" | "black" | "invalid" | { line: string; ply: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const steps = lines.map(line => line.split("\n").filter(row => row.trim()).map(row => {
      const [move, ...comment] = row.split("|");
      return [move.trim(), comment.join("|").trim()];
    }));
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/studies", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: form.get("name"), side: form.get("side"), lines: steps }) });
      if (!response.ok) {
        const { detail } = await response.json();
        const invalid = typeof detail === "string" && /^invalid_move\/(\d+)\/(\d+)$/.exec(detail);
        setError(invalid ? { line: invalid[1], ply: invalid[2] } : detail === "missing_black_move" ? "black" : "invalid");
        return;
      }
      const url = new URL(location.href);
      url.searchParams.set("chapter", id);
      location.assign(url);
    } catch { setError("save"); }
    finally { setBusy(false); }
  }
  return <main lang={language} className="study-page"><h1>{t("Новая учебная глава", "New study chapter", "Nuevo capítulo de estudio")}</h1>
    <form onSubmit={save}><fieldset disabled={busy}>
      <label>{t("Название главы", "Chapter title", "Título del capítulo")} <input name="name" required maxLength={100} /></label>
      <label>{t("Сторона игрока", "Play as", "Jugar con")} <select name="side"><option value="w">{t("Белые", "White", "Blancas")}</option><option value="b">{t("Чёрные", "Black", "Negras")}</option></select></label>
      <p>{t("Начните с исходной позиции. В каждой строке запишите один полуход. После знака | можно добавить пояснение, например «e4 | Занимаем центр».", "Start from the initial position. Enter one half-move per row. Add a comment after the vertical bar, for example: e4 | Occupy the center.", "Empieza en la posición inicial. Escribe una jugada de un solo bando por renglón. Puedes añadir un comentario después de la barra vertical, por ejemplo «e4 | Ocupa el centro».")}</p>
      {lines.map((line, index) => <div key={index}><label htmlFor={"line-" + index}>{t("Вариант", "Line", "Variante")} {index + 1}</label> <textarea id={"line-" + index} required rows={5} value={line}
        onChange={e => setLines(lines.map((text, i) => i === index ? e.target.value : text))} /></div>)}
      {lines.length < 12 && <button type="button" onClick={() => setLines([...lines, ""])}>{t("Добавить вариант", "Add line", "Añadir variante")}</button>}
      {lines.length > 1 && <button type="button" onClick={() => setLines(lines.slice(0, -1))}>{t("Убрать последний вариант", "Remove last line", "Quitar la última variante")}</button>}
      <p>{t("Сохранённая глава доступна каждому, у кого есть ссылка.", "Anyone with the link can open the saved chapter.", "Cualquier persona con el enlace puede abrir el capítulo guardado.")}</p>
      <button>{t("Сохранить главу", "Save chapter", "Guardar capítulo")}</button>{error && <p role="alert">{typeof error === "object" ?
        t(`Вариант ${error.line}, полуход ${error.ply}: проверьте запись хода.`, `Line ${error.line}, half-move ${error.ply}: check the notation.`, `Variante ${error.line}, media jugada ${error.ply}: revisa la notación.`) :
        error === "black" ? t("Для тренировки чёрными добавьте ответ чёрных в каждый вариант.", "Add a reply for Black to each line to train as Black.", "Para entrenar con negras, añade una respuesta de las negras a cada variante.") :
        error === "invalid" ? t("Проверьте название и варианты. В варианте допустимо от 1 до 100 полуходов, пояснение — до 500 символов.", "Check the title and lines. Each line needs 1–100 half-moves, with up to 500 characters per comment.", "Revisa el título y las variantes. Cada variante admite entre 1 y 100 medias jugadas y hasta 500 caracteres por comentario.") :
        t("Не удалось сохранить главу. Повторите попытку.", "Could not save the chapter. Try again.", "No se pudo guardar el capítulo. Vuelve a intentarlo.")}</p>}
    </fieldset></form></main>;
}

export function Study({ id }: { id: string }) {
  const { language, t } = useLanguage();
  const [chapter, setChapter] = useState<Chapter>();
  const [error, setError] = useState<"missing" | "load" | null>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/studies/" + id, { signal: abort.signal }).then(async response => {
      if (response.status === 404) { setError("missing"); return; }
      if (!response.ok) throw Error();
      const data = await response.json();
      if (!data || typeof data.name !== "string" || !["w", "b"].includes(data.side) ||
          !Array.isArray(data.lines) || !data.lines.length || !data.lines.every((line: unknown) =>
            Array.isArray(line) && line.length && line.every(step => Array.isArray(step) && step.length === 2 &&
              step.every(value => typeof value === "string")))) throw Error();
      if (!abort.signal.aborted) setChapter(data);
    }).catch(() => { if (!abort.signal.aborted) setError("load"); });
    return () => abort.abort();
  }, [id]);
  if (!chapter) return <main lang={language}><p role="status">{error === "missing" ? t("Глава не найдена", "Chapter not found", "Capítulo no encontrado") : error === "load" ? t("Не удалось загрузить главу", "Could not load the chapter", "No se pudo cargar el capítulo") : t("Загружаем главу…", "Loading chapter…", "Cargando capítulo…")}</p><a href="?section=openings">{t("К дебютам", "Back to openings", "Volver a las aperturas")}</a></main>;
  return <Trainer lineName={chapter.name + (chapter.lines.length > 1 ? " · " + (index + 1) : "")} key={index} steps={chapter.lines[index]} side={chapter.side} context={<>
    <h1>{chapter.name}</h1>
    {chapter.lines.length > 1 && <details open={typeof window !== "undefined" && window.matchMedia("(min-width: 681px)").matches}>
      <summary>{t("Выбрать вариант", "Choose line", "Elegir variante")}</summary>
      <label>{t("Учебный вариант", "Training line", "Variante de entrenamiento")} <select value={index} onChange={e => setIndex(Number(e.target.value))}>
      {chapter.lines.map((line, i) => <option value={i} key={i}>{i + 1}. {line.slice(0, 8).map(step => step[0]).join(" ")}</option>)}
    </select></label></details>}
    <a href={"?section=openings&chapter=" + id}>{t("Ссылка на главу", "Chapter link", "Enlace al capítulo")}</a>
  </>} />;
}
