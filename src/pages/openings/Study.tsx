import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { OpeningTrainer } from "./OpeningTrainer";
import { commandId } from "../../shared/commandId";
import { Board, initialPosition } from "../../entities/board";
import { panelStyles } from "../../shared/page-panels";
import styles from "./study.module.css";

interface Chapter { name: string; side: "w" | "b"; lines: [string, string][][] }
type EditorError = "save" | "black" | "invalid" | { line: string; ply: string } | null;
interface ChapterDraft { id: string; name: string; side: "w" | "b"; lines: string[]; error: EditorError }
const draftKey = "chessboard.study.draft";

function readDraft(): ChapterDraft {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
    if (saved && typeof saved.id === "string" && /^[0-9a-f]{32}$/.test(saved.id) && typeof saved.name === "string" &&
        ["w", "b"].includes(saved.side) && Array.isArray(saved.lines) && saved.lines.length > 0 &&
        saved.lines.length <= 12 && saved.lines.every((line: unknown) => typeof line === "string")) {
      const error = saved.error;
      const validError = ["save", "black", "invalid"].includes(error) ||
        (error && typeof error.line === "string" && typeof error.ply === "string");
      return { ...saved, error: validError ? error : null };
    }
  } catch { /* The editor remains usable with unavailable or damaged browser storage. */ }
  return { id: commandId(), name: "", side: "w", lines: [""], error: null };
}

export function ChapterEditor() {
  const { language, t } = useLanguage();
  const [draft, setDraft] = useState(readDraft);
  const { id, name, side, lines, error } = draft;
  const [storageFailed, setStorageFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  function persist(next: ChapterDraft, submitted = false) {
    setDraft(next);
    try {
      if (!submitted || JSON.parse(localStorage.getItem(draftKey) ?? "null")?.id === next.id) {
        localStorage.setItem(draftKey, JSON.stringify(next));
      }
      setStorageFailed(false);
    } catch { setStorageFailed(true); }
  }

  function edit(change: Partial<Pick<ChapterDraft, "name" | "side" | "lines">>) {
    // A retry uses the same publication ID until the author edits its content.
    persist({ ...draft, ...change, id: commandId(), error: null });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const steps = lines.map(line => line.split("\n").filter(row => row.trim()).map(row => {
      const [move, ...comment] = row.split("|");
      return [move.trim(), comment.join("|").trim()];
    }));
    setBusy(true);
    try {
      const response = await fetch("/api/studies", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, side, lines: steps }) });
      if (!response.ok) {
        if (response.status >= 500) throw new Error("study unavailable");
        const { detail } = await response.json();
        const invalid = typeof detail === "string" && /^invalid_move\/(\d+)\/(\d+)$/.exec(detail);
        persist({ ...draft, error: invalid ? { line: invalid[1], ply: invalid[2] } : detail === "missing_black_move" ? "black" : "invalid" }, true);
        return;
      }
      try {
        if (JSON.parse(localStorage.getItem(draftKey) ?? "null")?.id === id) localStorage.removeItem(draftKey);
      } catch { /* Publishing also works when the browser has disabled storage. */ }
      const url = new URL(location.href);
      url.searchParams.set("chapter", id);
      location.replace(url);
    } catch { persist({ ...draft, error: "save" }, true); }
    finally { setBusy(false); }
  }
  return <main lang={language} className="atlas-page"><h1>{t("Новая учебная глава", "New study chapter", "Nuevo capítulo de estudio")}</h1>
    <div className="atlas-columns"><form className="atlas-card" onSubmit={save}>
    <h2>{t("Содержание главы", "Chapter content", "Contenido del capítulo")}</h2>
    <fieldset className={styles.editor} disabled={busy}>
      <label>{t("Название главы", "Chapter title", "Título del capítulo")} <input name="name" value={name} onChange={e => edit({ name: e.target.value })} required maxLength={100} /></label>
      <label>{t("Сторона игрока", "Play as", "Jugar con")} <select name="side" value={side} onChange={e => edit({ side: e.target.value === "b" ? "b" : "w" })}><option value="w">{t("Белые", "White", "Blancas")}</option><option value="b">{t("Чёрные", "Black", "Negras")}</option></select></label>
      <p>{t("Начните с исходной позиции. В каждой строке запишите один полуход. После знака | можно добавить пояснение, например «e4 | Занимаем центр».", "Start from the initial position. Enter one half-move per row. Add a comment after the vertical bar, for example: e4 | Occupy the center.", "Empieza en la posición inicial. Escribe una jugada de un solo bando por renglón. Puedes añadir un comentario después de la barra vertical, por ejemplo «e4 | Ocupa el centro».")}</p>
      {lines.map((line, index) => <div key={index}><label htmlFor={"line-" + index}>{t("Вариант", "Line", "Variante")} {index + 1}</label> <textarea id={"line-" + index} required rows={5} value={line}
        onChange={e => edit({ lines: lines.map((text, i) => i === index ? e.target.value : text) })} /></div>)}
      {lines.length < 12 && <button type="button" onClick={() => edit({ lines: [...lines, ""] })}>{t("Добавить вариант", "Add line", "Añadir variante")}</button>}
      {lines.length > 1 && <button type="button" onClick={() => edit({ lines: lines.slice(0, -1) })}>{t("Убрать последний вариант", "Remove last line", "Quitar la última variante")}</button>}
      <p>{storageFailed ? t("Браузер не смог сохранить черновик. Оставьте редактор открытым до публикации.", "Your browser could not save the draft. Keep the editor open until you publish.", "Tu navegador no pudo guardar el borrador. Mantén abierto el editor hasta publicarlo.") :
        t("Черновик сохраняется в этом браузере.", "Your draft is saved in this browser.", "El borrador se guarda en este navegador.")} {t("Сохранённая глава доступна каждому, у кого есть ссылка.", "Anyone with the link can open the saved chapter.", "Cualquier persona con el enlace puede abrir el capítulo guardado.")}</p>
      <button className="atlas-primary">{t("Сохранить главу", "Save chapter", "Guardar capítulo")}</button>{!busy && error && <p role="alert">{typeof error === "object" ?
        t(`Вариант ${error.line}, полуход ${error.ply}: проверьте запись хода.`, `Line ${error.line}, half-move ${error.ply}: check the notation.`, `Variante ${error.line}, media jugada ${error.ply}: revisa la notación.`) :
        error === "black" ? t("Для тренировки чёрными добавьте ответ чёрных в каждый вариант.", "Add a reply for Black to each line to train as Black.", "Para entrenar con negras, añade una respuesta de las negras a cada variante.") :
        error === "invalid" ? t("Проверьте название и варианты. В варианте допустимо от 1 до 100 полуходов, пояснение — до 500 символов.", "Check the title and lines. Each line needs 1–100 half-moves, with up to 500 characters per comment.", "Revisa el título y las variantes. Cada variante admite entre 1 y 100 medias jugadas y hasta 500 caracteres por comentario.") :
        t("Не удалось сохранить главу. Повторите попытку.", "Could not save the chapter. Try again.", "No se pudo guardar el capítulo. Vuelve a intentarlo.")}</p>}
    </fieldset></form><aside className={`atlas-card ${panelStyles.boardPreview}`}><h2>{t("Начальная позиция", "Starting position", "Posición inicial")}</h2>
      <Board position={initialPosition} flipped={side === "b"} />
      <p>{side === "b" ? t("Вы играете чёрными", "You play Black", "Juegas con negras") : t("Вы играете белыми", "You play White", "Juegas con blancas")}</p>
    </aside></div></main>;
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
  if (!chapter) return <main className="atlas-page" lang={language}>
    <h1>{t("Учебная глава", "Study chapter", "Capítulo de estudio")}</h1>
    <section className="atlas-card"><p role="status">{error === "missing" ? t("Глава не найдена", "Chapter not found", "Capítulo no encontrado") : error === "load" ? t("Не удалось загрузить главу", "Could not load the chapter", "No se pudo cargar el capítulo") : t("Загружаем главу…", "Loading chapter…", "Cargando capítulo…")}</p><a href="?section=openings">{t("К дебютам", "Back to openings", "Volver a las aperturas")}</a></section></main>;
  return <OpeningTrainer title={chapter.name} chapterId={id} line={index} lineName={chapter.name + (chapter.lines.length > 1 ? " · " + (index + 1) : "")} key={index} steps={chapter.lines[index]} side={chapter.side} settings={
    chapter.lines.length > 1 && <details open={typeof window !== "undefined" && window.matchMedia("(min-width: 681px)").matches}>
      <summary>{t("Выбрать вариант", "Choose line", "Elegir variante")}</summary>
      <label>{t("Учебный вариант", "Training line", "Variante de entrenamiento")} <select value={index} onChange={e => setIndex(Number(e.target.value))}>
      {chapter.lines.map((line, i) => <option value={i} key={i}>{i + 1}. {line.slice(0, 8).map(step => step[0]).join(" ")}</option>)}
    </select></label></details>} context={<>
    <a href={"?section=openings&chapter=" + id}>{t("Ссылка на главу", "Chapter link", "Enlace al capítulo")}</a>
  </>} />;
}
