import React from "react";
import styles from "./layout.module.css";

interface Props {
  title?: React.ReactNode;
  lang?: string;
  gameWorkspace?: boolean;
  board: React.ReactNode;
  context?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  footer?: React.ReactNode;
}

export function BoardLayout({ title, lang, gameWorkspace, board, context, actions, status, footer }: Props) {
  return <main lang={lang} className={styles.layout} data-game-workspace={gameWorkspace || undefined}>
    {title && <h1>{title}</h1>}
    <div className={styles.board}>{board}</div>
    {(actions || context || status) && <div className={styles.panel}>
      {actions && <section className={styles.actions + " game-actions"}>{actions}</section>}
      {status && <div className={styles.status}>{status}</div>}
      {context && <aside className={styles.context + " game-context"}>{context}</aside>}
    </div>}
    {footer && <div className={styles.footer}>{footer}</div>}
  </main>;
}

export function BoardSeat({ side, name, detail, clock, active }: {
  side: "white" | "black"; name: React.ReactNode; detail?: React.ReactNode; clock?: React.ReactNode; active?: boolean;
}) {
  return <div className={styles.seat}>
    <span className={styles.avatar} data-side={side} aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1.5c0-3.1 2.8-5.1 7-5.1s7 2 7 5.1V20"/></svg></span>
    <div className={styles.identity}><strong>{name}</strong>{detail && <small>{detail}</small>}</div>
    {clock && <strong className={styles.clock} data-active={active || undefined}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>{clock}</strong>}
  </div>;
}
