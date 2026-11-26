import React from "react";
import styles from "./page.module.css";

export { styles as panelStyles };

export function PlayerAvatar({ name, own = false }: { name: string; own?: boolean }) {
  return <span className={styles.avatar} data-own={own} aria-hidden="true">{Array.from(name)[0]?.toLocaleUpperCase()}</span>;
}
