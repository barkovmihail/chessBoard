import React from "react";
import { Board, initialPosition } from "../../entities/board";
import styles from "./game.module.css";

export function GamePage() {
  return <main className={styles.app}><Board position={initialPosition} /></main>;
}
