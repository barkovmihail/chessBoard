import React, { useState } from "react";
import { useLanguage } from "../../shared/language";
import styles from "./game.module.css";

export function MoveRecord({ moves, pieceCount }: { moves: string[]; pieceCount: number }) {
  const { t } = useLanguage();
  const [showPosition, setShowPosition] = useState(false);
  return <>
    <h2>{t("Запись партии", "Game record", "Registro de la partida")}</h2>
    <div className={styles.switches}>
      <button aria-pressed={!showPosition} onClick={() => setShowPosition(false)}>{t("Ходы", "Moves", "Jugadas")}</button>
      <button aria-pressed={showPosition} onClick={() => setShowPosition(true)}>{t("Позиция", "Position", "Posición")}</button>
    </div>
    {showPosition ? <dl className={styles.facts}>
      <div><dt>{t("Фигур на доске", "Pieces on board", "Piezas en el tablero")}</dt><dd>{pieceCount}</dd></div>
      {moves.length > 0 && <div><dt>{t("Последний ход", "Last move", "Última jugada")}</dt><dd>{moves[moves.length - 1]}</dd></div>}
    </dl> : <div>
      <div className={styles.historyHead} aria-hidden="true"><span>{t("Ход", "Move", "Jugada")}</span><span>{t("Белые", "White", "Blancas")}</span><span>{t("Чёрные", "Black", "Negras")}</span></div>
      <ol aria-label={t("Запись ходов", "Move list", "Lista de jugadas")} className={styles.history}>
        {moves.map((move, i) => i % 2 === 0 && <li key={i}><small>{i / 2 + 1}.</small>{" "}<span>{move}</span>{" "}<span>{moves[i + 1]}</span></li>)}
      </ol>
      {!moves.length && <p className={styles.emptyRecord}>{t("Ходов пока нет", "No moves yet", "Todavía no hay jugadas")}</p>}
    </div>}
  </>;
}
