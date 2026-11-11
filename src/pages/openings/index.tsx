import { useLanguage } from "../../shared/language";
import React from "react";
import { OpeningReview } from "./OpeningReview";
import { OpeningTrainer } from "./OpeningTrainer";
import { ChapterEditor, Study } from "./Study";
import { lessonsByLanguage } from "./lessons";

export function OpeningsPage() {
  const { language, t } = useLanguage();
  const lessons = lessonsByLanguage[language];
  const params = new URLSearchParams(location.search);
  if (params.get("review") === "today") return <OpeningReview />;
  const chapter = params.get("chapter");
  if (chapter === "new") return <ChapterEditor />;
  if (chapter && /^[0-9a-f]{32}$/.test(chapter)) return <Study id={chapter} />;
  const lesson = chapter === null ? lessons[0] : lessons.find(item => item.id === chapter);
  if (!lesson) {
    params.delete("chapter");
    return <main lang={language}><h1>{t("Глава не найдена", "Chapter not found", "Capítulo no encontrado")}</h1><a href={"?" + params}>{t("К тренажёру дебютов", "Back to opening trainer", "Volver al entrenador de aperturas")}</a></main>;
  }
  return <OpeningTrainer chapterId={lesson.id} line={0} lineName={lesson.name} key={lesson.id} steps={lesson.steps} side={lesson.side} context={<><h1>{t("Тренажёр дебютов", "Opening trainer", "Entrenador de aperturas")}</h1>
    <p>{lesson.idea}</p>
    <details open={typeof window !== "undefined" && window.matchMedia("(min-width: 681px)").matches}><summary>{t("Выбрать дебют", "Choose opening", "Elegir apertura")}</summary>
    <label htmlFor="lesson">{t("Дебют", "Opening", "Apertura")} </label><select id="lesson" value={lesson.id} onChange={event => {
      params.set("chapter", event.target.value);
      location.assign("?" + params);
    }}>
      {lessons.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></details>
    <a href={"?" + new URLSearchParams({ ...Object.fromEntries(params), chapter: "new" })}>{t("Создать главу", "Create chapter", "Crear capítulo")}</a>
    <a href={"?section=openings&chapter=" + lesson.id}>{t("Ссылка на главу", "Chapter link", "Enlace al capítulo")}</a>
  </>} />;
}
