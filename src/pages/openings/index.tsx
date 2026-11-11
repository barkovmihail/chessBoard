import React, { useState } from "react";
import { Trainer } from "../../features/training";
import { lessons } from "./lessons";

export function OpeningsPage() {
  const [index, choose] = useState(0);
  const lesson = lessons[index];
  return <Trainer key={lesson.name} steps={lesson.steps} side={lesson.side} context={<><h1>Тренажёр дебютов</h1>
    <label htmlFor="lesson">Дебют </label><select id="lesson" value={index} onChange={event => choose(Number(event.target.value))}>
      {lessons.map((item,i) => <option key={item.name} value={i}>{item.name}</option>)}
    </select>
    <p>{lesson.idea}</p>
  </>} />;
}
