import { useLanguage } from "../../shared/language";
import React from "react";
import { Trainer } from "../../features/training";
import { ChapterEditor, Study } from "./Study";
import { lessonsByLanguage } from "./lessons";

export function OpeningsPage() {
  const { language, t } = useLanguage();
  const lessons = lessonsByLanguage[language === "es" ? "en" : language];
  const params = new URLSearchParams(location.search);
  const chapter = params.get("chapter");
  if (chapter === "new") return <ChapterEditor />;
  if (chapter && /^[0-9a-f]{32}$/.test(chapter)) return <Study id={chapter} />;
  const lesson = chapter === null ? lessons[0] : lessons.find(item => item.id === chapter);
  if (!lesson) {
    params.delete("chapter");
    return <main lang={language}><h1>{t("Глава не найдена", "Chapter not found")}</h1><a href={"?" + params}>{t("К тренажёру дебютов", "Back to opening trainer")}</a></main>;
  }
  return <Trainer key={lesson.id} steps={lesson.steps} side={lesson.side} context={<><h1>{t("Тренажёр дебютов", "Opening trainer")}</h1>
    <label htmlFor="lesson">{t("Дебют", "Opening")} </label><select id="lesson" value={lesson.id} onChange={event => {
      params.set("chapter", event.target.value);
      location.assign("?" + params);
    }}>
      {lessons.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <a href={"?" + new URLSearchParams({ ...Object.fromEntries(params), chapter: "new" })}>{t("Создать главу", "Create chapter")}</a>
    <p>{lesson.idea}</p>
    <a href={"?section=openings&chapter=" + lesson.id}>{t("Ссылка на главу", "Chapter link")}</a>
  </>} />;
}
