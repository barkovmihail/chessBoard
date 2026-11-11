import React, { useEffect, useState } from "react";
import type { Game } from "../../features/play";
import { QuickGame } from "./QuickGame";
import styles from "./game.module.css";

const presets: [string, number, number][] = [
  ["Пуля", 1, 0], ["Пуля", 2, 1], ["Блиц", 3, 0], ["Блиц", 3, 2],
  ["Блиц", 5, 0], ["Блиц", 5, 3], ["Рапид", 10, 0], ["Рапид", 10, 5],
  ["Рапид", 15, 10], ["Классика", 30, 0], ["Классика", 30, 20],
];

export function TimeSetup({ create, busy }: {
  create: (online: boolean, control: { minutes: number; increment: number }) => void; busy: boolean;
}) {
  const [searching, setSearching] = useState(false);
  const [selected, select] = useState(5);
  const [minutes, setMinutes] = useState("7");
  const [increment, setIncrement] = useState("2");
  const custom = selected === presets.length;
  const control = custom ? { minutes: Number(minutes), increment: Number(increment) } :
    { minutes: presets[selected][1], increment: presets[selected][2] };
  const valid = !custom || (/^\d+$/.test(minutes) && /^\d+$/.test(increment) &&
    control.minutes >= 1 && control.minutes <= 1440 && control.increment <= 3600);
  return <fieldset disabled={busy}><legend>Контроль времени</legend>
    {!searching && <div className={styles.presets}>{presets.map(([label, min, inc], index) =>
      <button key={index} aria-pressed={index === selected} onClick={() => select(index)}>
        <strong>{min}+{inc}</strong><small>{label}</small></button>)}
      <button aria-pressed={custom} onClick={() => select(presets.length)}>Своя игра</button></div>}
    {custom && !searching && <div><label>Минут на игрока <input type="number" min="1" max="1440"
      value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
      <label>Добавка за ход, секунд <input type="number" min="0" max="3600"
        value={increment} onChange={e => setIncrement(e.target.value)} /></label>
      <p>{valid ? minutes + "+" + increment : "Введите 1–1440 минут и 0–3600 секунд целыми числами."}</p></div>}
    <QuickGame control={control} valid={valid} onSearching={setSearching} />
    <button disabled={!valid || searching} onClick={() => create(false, control)}>Начать партию</button>
    <button disabled={!valid || searching} onClick={() => create(true, control)}>Пригласить друга</button>
  </fieldset>;
}

export function ClockPanel({ game, clock }: { game: Game; clock: NonNullable<Game["clock"]> }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (clock.deadline_ms === null) return;
    const timer = setInterval(() => tick(value => value + 1), 200);
    return () => clearInterval(timer);
  }, [clock.deadline_ms]);
  const now = clock.server_ms + performance.now() - clock.received_ms;
  return <section aria-label="Шахматные часы">
    <strong>{clock.base_minutes}+{clock.increment_seconds}</strong>
    {(["white", "black"] as const).map(side => {
      const ms = game.turn === side && clock.deadline_ms !== null ? clock.deadline_ms - now : clock[side + "_ms" as "white_ms" | "black_ms"];
      const seconds = Math.max(0, Math.ceil(ms / 1000));
      return <span key={side} className={styles.clock}>{side === "white" ? "Белые" : "Чёрные"} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>;
    })}
  </section>;
}
