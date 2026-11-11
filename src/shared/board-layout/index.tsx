import React from "react";
import styles from "./layout.module.css";

interface Props {
  lang?: string;
  board: React.ReactNode;
  context?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
}

export function BoardLayout({ lang, board, context, actions, status }: Props) {
  return <main lang={lang} className={styles.layout}>
    {status && <header className={styles.status}>{status}</header>}
    {context && <aside className={styles.context}>{context}</aside>}
    <div className={styles.board}>{board}</div>
    {actions && <section className={styles.actions}>{actions}</section>}
  </main>;
}
