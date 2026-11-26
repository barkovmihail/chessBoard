import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";

import { NotificationSettings } from "./NotificationSettings";
import { panelStyles as styles } from "../../shared/page-panels";

const spanishPools = { bullet: "Bala", blitz: "Blitz", rapid: "Rápidas", classical: "Clásicas" };
const englishPools = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical" };
const pools = { bullet: "Пуля", blitz: "Блиц", rapid: "Рапид", classical: "Классика" } as const;

const errors: Record<string, [string, string]> = {
  "Не удалось загрузить профиль. Обновите страницу.": ["Could not load the profile. Reload the page.", "No se pudo cargar el perfil. Recarga la página."],
  "Это имя уже занято.": ["This name is taken.", "Este nombre ya está en uso."],
  "Проверьте имя и пароль.": ["Check your name and password.", "Comprueba el nombre y la contraseña."],
  "Не удалось выполнить действие. Обновите страницу.": ["Could not complete the action. Reload the page.", "No se pudo completar la acción. Recarga la página."],
  "Нет связи с сервером. Попробуйте ещё раз.": ["Could not connect to the server. Try again.", "No se pudo conectar con el servidor. Inténtalo de nuevo."],
};

interface AccountProps {
  auth: boolean;
  settings: boolean;
  register: boolean;
  onMode: (register: boolean) => void;
  onIdentity: (name: string | null) => void;
}

export function Account({ auth, settings, register, onMode, onIdentity }: AccountProps) {
  const { t } = useLanguage();
  const [account, setAccount] = useState<string | null>();
  const [ratings, setRatings] = useState<Record<keyof typeof pools, number>>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/account", { signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !(data.name === null || typeof data.name === "string")) throw Error();
      if (data.name && !Object.keys(pools).every(key => Number.isInteger(data.ratings?.[key]))) throw Error();
      if (!abort.signal.aborted) {
        setRatings(data.ratings);
        setAccount(data.name);
        onIdentity(data.name);
      }
    }).catch(() => { if (!abort.signal.aborted) setError("Не удалось загрузить профиль. Обновите страницу."); });
    return () => abort.abort();
  }, [onIdentity]);

  async function submit(form?: HTMLFormElement) {
    const fields = form && new FormData(form);
    setBusy(true);
    setError("");
    try {
      const action = account ? "logout" : register ? "register" : "login";
      const response = await fetch("/api/account/" + action, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: fields && JSON.stringify({ name: fields.get("name"), password: fields.get("password") }),
      });
      if (response.ok) { location.reload(); return; }
      const { detail } = await response.json();
      setError(detail === "account_exists" ? "Это имя уже занято." : detail === "invalid_credentials" ?
        "Проверьте имя и пароль." : "Не удалось выполнить действие. Обновите страницу.");
    } catch { setError("Нет связи с сервером. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }

  if (account && settings) return <NotificationSettings standalone />;
  return <section className="atlas-card" id="account" aria-label={t("Аккаунт", "Account", "Cuenta")}>
    {account ? <><h2>{account}</h2><h3>{t("Рейтинг игрока", "Player ratings", "Puntuaciones del jugador")}</h3>
      {ratings && <div className={styles.metrics}>{(Object.keys(pools) as (keyof typeof pools)[]).map(key =>
        <div key={key}><span>{t(pools[key], englishPools[key], spanishPools[key])} · </span><strong>{ratings[key]}</strong></div>)}</div>}
      <div className={styles.stack}><NotificationSettings /><button disabled={busy} onClick={() => submit()}>{t("Выйти", "Sign out", "Cerrar sesión")}</button></div></> :
      account === null && <form className={styles.form} onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }}>
        <h2>{auth ? t("Учётная запись", "Account", "Cuenta") : register ? t("Регистрация", "Registration", "Registro") : t("Вход", "Sign in", "Iniciar sesión")}</h2>
        {auth && <div className={styles.modeSwitch} role="group" aria-label={t("Доступ к аккаунту", "Account access", "Acceso a la cuenta")}>
          <button type="button" disabled={busy} aria-pressed={!register} onClick={() => { onMode(false); setError(""); }}>{t("Вход", "Login", "Acceso")}</button>
          <button type="button" disabled={busy} aria-pressed={register} onClick={() => { onMode(true); setError(""); }}>{t("Регистрация", "Registration", "Registro")}</button>
        </div>}
        <label>{t("Имя игрока", "Player name", "Nombre de jugador")} <input name="name" required autoComplete="username" pattern="[A-Za-z0-9_]{3,32}"
          title={t("От 3 до 32 латинских букв, цифр или знаков подчёркивания", "3\u201332 Latin letters, numbers or underscores", "Entre 3 y 32 letras latinas, números o guiones bajos")} /></label>
        <label>{t("Пароль", "Password", "Contraseña")} <input name="password" type="password" minLength={8} maxLength={128} required
          autoComplete={register ? "new-password" : "current-password"} /></label>
        {register && <p>{t("Имя — от 3 до 32 латинских букв, цифр или знаков подчёркивания. Пароль — от 8 символов. Партии из этого гостевого профиля сохранятся в аккаунте.", "Use 3–32 Latin letters, numbers or underscores for your name and at least 8 characters for your password. Your guest games will carry over to your account.", "Elige un nombre de entre 3 y 32 letras latinas, números o guiones bajos y una contraseña de al menos 8 caracteres. Las partidas que jugaste como invitado se guardarán en tu cuenta.")}</p>}
        <button className="atlas-primary" disabled={busy}>{register ? t("Создать аккаунт", "Create account", "Crear cuenta") : t("Войти", "Sign in", "Iniciar sesión")}</button>
        <button type="button" disabled={busy} onClick={() => { onMode(!register); setError(""); }}>
          {register ? t("У меня есть аккаунт", "I have an account", "Ya tengo una cuenta") : t("Зарегистрироваться", "Register", "Registrarse")}
        </button>
      </form>}
    {account === undefined && !error && <p role="status">{t("Загрузка…", "Loading…", "Cargando…")}</p>}
    {error && <p role="alert">{t(error, ...errors[error])}</p>}
  </section>;
}
