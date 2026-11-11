import React, { useEffect, useState } from "react";

import { NotificationSettings } from "./NotificationSettings";

const pools = { bullet: "Пуля", blitz: "Блиц", rapid: "Рапид", classical: "Классика" } as const;

export function Account() {
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

  return <section aria-label="Аккаунт">
    {account ? <><h2>{account}</h2><NotificationSettings /><h3>Рейтинг</h3>
      {ratings && <ul>{(Object.keys(pools) as (keyof typeof pools)[]).map(key =>
        <li key={key}>{pools[key]} · {ratings[key]}</li>)}</ul>}<button disabled={busy} onClick={() => submit()}>Выйти</button></> :
      account === null && <form onSubmit={event => { event.preventDefault(); submit(event.currentTarget); }}>
        <h2>{register ? "Регистрация" : "Вход"}</h2>
        <label>Имя игрока <input name="name" required autoComplete="username" pattern="[A-Za-z0-9_]{3,32}"
          title="От 3 до 32 латинских букв, цифр или знаков подчёркивания" /></label>
        <label>Пароль <input name="password" type="password" minLength={8} maxLength={128} required
          autoComplete={register ? "new-password" : "current-password"} /></label>
        {register && <p>Имя — от 3 до 32 латинских букв, цифр или знаков подчёркивания. Пароль — от 8 символов.
          Партии из этого гостевого профиля сохранятся в аккаунте.</p>}
        <button disabled={busy}>{register ? "Создать аккаунт" : "Войти"}</button>
        <button type="button" disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>
          {register ? "У меня есть аккаунт" : "Зарегистрироваться"}
        </button>
      </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
