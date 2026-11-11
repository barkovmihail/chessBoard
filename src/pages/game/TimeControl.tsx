import { Button, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/tokens/base.css";
import "@radix-ui/themes/tokens/colors/sand.css";
import "@radix-ui/themes/tokens/colors/bronze.css";
import "@radix-ui/themes/components.css";
import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";
import { Game, EngineLevel, isEngineLevel, levelLabels } from "../../features/play";
import { QuickGame } from "./QuickGame";
import styles from "./game.module.css";

const categories = { "Пуля": "Bullet", "Блиц": "Blitz", "Рапид": "Rapid", "Классика": "Classical" };
const spanishCategories = { "Пуля": "Bala", "Блиц": "Blitz", "Рапид": "Rápidas", "Классика": "Clásicas" };
type Category = keyof typeof categories;
const presets: [Category, number, number][] = [
  ["Пуля", 1, 0], ["Пуля", 2, 1], ["Блиц", 3, 0], ["Блиц", 3, 2],
  ["Блиц", 5, 0], ["Блиц", 5, 3], ["Рапид", 10, 0], ["Рапид", 10, 5],
  ["Рапид", 15, 10], ["Классика", 30, 0], ["Классика", 30, 20],
];

export function TimeSetup({ create, busy, board }: {
  board: React.ReactNode;
  create: (online: boolean, control: { minutes: number; increment: number }, level?: Game["engine_level"], engine?: Game["engine_name"], visible?: boolean, chess960?: number) => void; busy: boolean;
}) {
  const { language, t } = useLanguage();
  const [index, setIndex] = useState(() => String(Math.floor(Math.random() * 960)));
  const [computer, setComputer] = useState(false);
  const [visible, setVisible] = useState(false);
  const [engine, setEngine] = useState<"lc0" | "stockfish">("lc0");
  const [level, setLevel] = useState<EngineLevel>("easy");
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState("");
  const [selected, select] = useState(5);
  const [minutes, setMinutes] = useState("7");
  const [increment, setIncrement] = useState("2");
  const custom = selected === presets.length;
  const control = custom ? { minutes: Number(minutes), increment: Number(increment) } :
    { minutes: presets[selected][1], increment: presets[selected][2] };
  const validMinutes = /^\d+$/.test(minutes) && Number(minutes) >= 1 && Number(minutes) <= 1440;
  const validIncrement = /^\d+$/.test(increment) && Number(increment) <= 3600;
  const valid = !custom || (validMinutes && validIncrement);
  return <Theme style={{ minHeight: 0 }} hasBackground={false} accentColor="bronze" grayColor="sand" radius="medium"><fieldset className={styles.lobby} lang={language} disabled={busy}>
    <div className={styles.preview}><h2>{t("Начальная позиция", "Starting position", "Posición inicial")}</h2>{board}</div>
    <section className={styles.start}><h1>{t("Быстрый старт", "Quick start", "Inicio rápido")}</h1>
    {!searching && <label>{t("Категория времени", "Time category", "Ritmo de juego")} <select value={category} onChange={event => {
      const value = event.target.value;
      setCategory(value);
      if (value && presets[selected]?.[0] !== value) select(presets.findIndex(preset => preset[0] === value));
    }}>
      <option value="">{t("Все категории", "All categories", "Todos los ritmos")}</option>
      {(Object.keys(categories) as Category[]).map(label => <option key={label} value={label}>{t(label, categories[label], spanishCategories[label])}</option>)}
    </select></label>}
    {!searching && <div className={styles.presets}>{presets.map(([label, min, inc], index) => (!category || label === category) &&
      <button key={index} aria-pressed={index === selected} onClick={() => select(index)}>
        <strong>{min}+{inc}</strong><small>{t(label, categories[label], spanishCategories[label])}</small></button>)}
      <button aria-pressed={custom} onClick={() => { setCategory(""); select(presets.length); }}>{t("Своя игра", "Custom game", "Partida personalizada")}</button></div>}
    {custom && !searching && <div className={styles.customClock}><label>{t("Минут на игрока", "Minutes per player", "Minutos por jugador")} <input type="number" min="1" max="1440"
      aria-invalid={!validMinutes} aria-describedby={validMinutes ? undefined : "minutes-error"}
      value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
      {!validMinutes && <small id="minutes-error">{t("Введите целое число от 1 до 1440.", "Enter a whole number from 1 to 1440.", "Introduce un número entero entre 1 y 1440.")}</small>}
      <label>{t("Добавка за ход, секунд", "Increment per move, seconds", "Incremento por jugada en segundos")} <input type="number" min="0" max="3600"
        aria-invalid={!validIncrement} aria-describedby={validIncrement ? undefined : "increment-error"}
        value={increment} onChange={e => setIncrement(e.target.value)} /></label>
      {!validIncrement && <small id="increment-error">{t("Введите целое число от 0 до 3600.", "Enter a whole number from 0 to 3600.", "Introduce un número entero entre 0 y 3600.")}</small>}
      {valid && <p>{minutes}+{increment}</p>}</div>}
    </section>
    <section className={styles.settings}><h2>{t("Новая партия", "New game", "Nueva partida")}</h2>
    {!searching && <fieldset><legend>{t("Соперник", "Opponent", "Rival")}</legend>
      <label><input type="radio" name="opponent" checked={!computer} onChange={() => setComputer(false)} /> {t("Человек", "Human", "Persona")}</label>
      <label><input type="radio" name="opponent" checked={computer} onChange={() => setComputer(true)} /> {t("Компьютер", "Computer", "Ordenador")}</label>
    </fieldset>}
    <div hidden={computer && !searching}><QuickGame control={control} valid={valid} onSearching={setSearching} /></div>
    {!searching && <label><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> {t("Разрешить просмотр по ссылке", "Allow spectators with the link", "Permitir espectadores con el enlace")}</label>}
    {!computer && <div className={styles.gameActions}><Button size="3" variant="soft" disabled={!valid || searching} onClick={() => create(false, control, undefined, undefined, visible)}>{t("Начать партию", "Start game", "Iniciar partida")}</Button>
    <Button size="3" highContrast variant="solid" disabled={!valid || searching} onClick={() => create(true, control, undefined, undefined, visible)}>{t("Пригласить друга", "Invite a friend", "Invitar a un amigo")}</Button></div>}
    {!computer && !searching && <details><summary>Chess960</summary>
      <label>{t("Номер расстановки", "Starting position number", "Número de posición inicial")} <input type="number" min="0" max="959" value={index} onChange={e => setIndex(e.target.value)} /></label>
      <button onClick={() => setIndex(String(Math.floor(Math.random() * 960)))}>{t("Случайная расстановка", "Random position", "Posición aleatoria")}</button>
      <button disabled={!valid || !/^\d{1,3}$/.test(index) || Number(index) > 959}
        onClick={() => create(false, control, undefined, undefined, visible, Number(index))}>{t("Начать Chess960 на одном устройстве", "Play Chess960 on one device", "Jugar al Chess960 en un dispositivo")}</button>
    </details>}
    {computer && !searching && <fieldset><legend>{t("Настройки движка", "Engine settings", "Ajustes del motor")}</legend>
      <label>{t("Движок", "Engine", "Motor")} <select aria-label={t("Движок", "Engine", "Motor")} value={engine} onChange={e => setEngine(e.target.value === "stockfish" ? "stockfish" : "lc0")}>
        <option value="lc0">Leela Chess Zero</option><option value="stockfish">Stockfish</option></select></label>
      <label>{t("Уровень", "Level", "Nivel")} <select aria-label={t("Уровень", "Level", "Nivel")} value={level} onChange={e => { if (isEngineLevel(e.target.value)) setLevel(e.target.value); }}>
        {Object.entries(levelLabels).map(([value, [ru, en]]) => <option key={value} value={value}>{t(ru, en)}</option>)}</select></label>
      <Button size="3" highContrast variant="solid" disabled={!valid} onClick={() => create(false, control, level, engine, visible)}>{t("Играть с компьютером", "Play against the computer", "Jugar contra el ordenador")}</Button>
    </fieldset>}
    </section>
  </fieldset></Theme>;
}

export function ClockPanel({ game, children }: { game: Game; children: React.ReactNode }) {
  const { language, t } = useLanguage();
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
    return <div lang={language} className={styles.player}><span>{side === "white" ? t("Белые", "White", "Blancas") : t("Чёрные", "Black", "Negras")}
      {side === game.side && t(" · Вы", " · You", " · Tú")}</span><strong>{time}</strong></div>;
  }
  return <section aria-label={clock ? t("Шахматные часы", "Chess clocks", "Relojes de ajedrez") : t("Стороны партии", "Players", "Jugadores")}>
    {clock && <small>{clock.base_minutes}+{clock.increment_seconds}</small>}
    {player(game.side === "black" ? "white" : "black")}
    {children}
    {player(game.side === "black" ? "black" : "white")}
  </section>;
}
