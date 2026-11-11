import { useLanguage } from "../../shared/language";
import React, { useEffect, useState } from "react";

import { NotificationSettings } from "./NotificationSettings";

const englishPools = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical" };
const pools = { bullet: "Пуля", blitz: "Блиц", rapid: "Рапид", classical: "Классика" } as const;

const errors: Record<string, string> = {
  "Не удалось загрузить профиль. Обновите страницу.": "Could not load the profile. Reload the page.",
  "Это имя уже занято.": "This name is taken.",
  "Проверьте имя и пароль.": "Check your name and password.",
  "Не удалось выполнить действие. Обновите страницу.": "Could not complete the action. Reload the page.",
  "Нет связи с сервером. Попробуйте ещё раз.": "Could not connect to the server. Try again.",
};

export function Account() {
  const { language, t } = useLanguage();
  const [account, setAccount] = useState<string | null>();
  const [ratings, setRatings] = useState<Record<keyof typeof pools, number>>();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/account", { signal: abort.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !(data.name === null || typeof data.name === "string")) throw Error();
      if (data.name && !Object.keys(pools).every(key => Number.isInteger(data.ratings?.[key]))) throw Error();
      setRatings(data.ratings);
      setAccount(data.name);
    }).catch(() => { if (!abort.signal.aborted) setError("Не удалось загрузить профиль. Обновите страницу."); });
    return () => abort.abort();
  }, []);

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

  return <section id="account" aria-label={t("Аккаунт", "Account")}>
    {account ? <><h2>{account}</h2><NotificationSettings /><h3>{t("Рейтинг", "Ratings")}</h3>
      {ratings && <ul>{(Object.keys(pools) as (keyof typeof pools)[]).map(key =>
        <li key={key}>{language === "ru" ? pools[key] : englishPools[key]} · {ratings[key]}</li>)}</ul>}<button disabled={busy} onClick={() => submit()}>{t("Выйти", "Sign out")}</button></> :
      account === null && <form onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }}>
        <h2>{register ? t("Регистрация", "Registration") : t("Вход", "Sign in")}</h2>
        <label>{t("Имя игрока", "Player name")} <input name="name" required autoComplete="username" pattern="[A-Za-z0-9_]{3,32}"
          title={t("От 3 до 32 латинских букв, цифр или знаков подчёркивания", "3\u201332 Latin letters, numbers or underscores")} /></label>
        <label>{t("Пароль", "Password")} <input name="password" type="password" minLength={8} maxLength={128} required
          autoComplete={register ? "new-password" : "current-password"} /></label>
        {register && <p>{t("Имя — от 3 до 32 латинских букв, цифр или знаков подчёркивания. Пароль — от 8 символов. Партии из этого гостевого профиля сохранятся в аккаунте.", "Use 3–32 Latin letters, numbers or underscores for your name and at least 8 characters for your password. Your guest games will carry over to your account.")}</p>}
        <button disabled={busy}>{register ? t("Создать аккаунт", "Create account") : t("Войти", "Sign in")}</button>
        <button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>
          {register ? t("У меня есть аккаунт", "I have an account") : t("Зарегистрироваться", "Register")}
        </button>
      </form>}
    {error && <p role="alert">{t(error, errors[error] ?? error)}</p>}
  </section>;
}
