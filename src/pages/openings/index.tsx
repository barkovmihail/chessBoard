import React from "react";
import { Trainer } from "../../features/training";
import { lessons } from "./lessons";

export function OpeningsPage() {
  const params = new URLSearchParams(location.search);
  const chapter = params.get("chapter");
  const lesson = chapter === null ? lessons[0] : lessons.find(item => item.id === chapter);
  if (!lesson) {
    params.delete("chapter");
    return <main><h1>Глава не найдена</h1><a href={"?" + params}>К тренажёру дебютов</a></main>;
  }
  return <Trainer key={lesson.id} steps={lesson.steps} side={lesson.side} context={<><h1>Тренажёр дебютов</h1>
    <label htmlFor="lesson">Дебют </label><select id="lesson" value={lesson.id} onChange={event => {
      params.set("chapter", event.target.value);
      location.assign("?" + params);
    }}>
      {lessons.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <p>{lesson.idea}</p>
    <a href={"?section=openings&chapter=" + lesson.id}>Ссылка на главу</a>
  </>} />;
}
