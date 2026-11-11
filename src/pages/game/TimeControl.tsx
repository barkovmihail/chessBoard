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
  create: (online: boolean, control: { minutes: number; increment: number }, level?: Game["engine_level"], engine?: Game["engine_name"], visible?: boolean) => void; busy: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [engine, setEngine] = useState<"lc0" | "stockfish">("lc0");
  const [level, setLevel] = useState<"easy" | "normal">("easy");
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
    {!searching && <label><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> Разрешить просмотр по ссылке</label>}
    <button disabled={!valid || searching} onClick={() => create(false, control, undefined, undefined, visible)}>Начать партию</button>
    <button disabled={!valid || searching} onClick={() => create(true, control, undefined, undefined, visible)}>Пригласить друга</button>
    {!searching && <fieldset><legend>Компьютер</legend>
      <label>Движок <select value={engine} onChange={e => setEngine(e.target.value === "stockfish" ? "stockfish" : "lc0")}>
        <option value="lc0">Leela Chess Zero</option><option value="stockfish">Stockfish</option></select></label>
      <label>Уровень <select value={level} onChange={e => setLevel(e.target.value === "normal" ? "normal" : "easy")}>
        <option value="easy">Начальный</option><option value="normal">Обычный</option></select></label>
      <button disabled={!valid} onClick={() => create(false, control, level, engine, visible)}>Играть с компьютером</button>
    </fieldset>}
  </fieldset>;
}

export function ClockPanel({ game, children }: { game: Game; children: React.ReactNode }) {
  const { clock } = game;
  const [, tick] = useState(0);
  useEffect(() => {
    if (clock?.deadline_ms == null) return;
    const timer = setInterval(() => tick(value => value + 1), 200);
    return () => clearInterval(timer);
  }, [clock?.deadline_ms]);

  function player(side: "white" | "black") {
    let time = "";
    if (clock) {
      const now = clock.server_ms + performance.now() - clock.received_ms;
      const remaining = game.turn === side && clock.deadline_ms !== null ? clock.deadline_ms - now :
        side === "white" ? clock.white_ms : clock.black_ms;
      const seconds = Math.max(0, Math.ceil(remaining / 1000));
      time = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    }
    return <div className={styles.player}><span>{side === "white" ? "Белые" : "Чёрные"}
      {side === game.side && " · Вы"}</span><strong>{time}</strong></div>;
  }
  return <section aria-label={clock ? "Шахматные часы" : "Стороны партии"}>
    {clock && <small>{clock.base_minutes}+{clock.increment_seconds}</small>}
    {player(game.side === "black" ? "white" : "black")}
    {children}
    {player(game.side === "black" ? "black" : "white")}
  </section>;
}
