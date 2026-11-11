import React from "react";
import { useLanguage } from "../language";

export function ReplayButtons({ ply, total, onSelect }: { ply: number; total: number; onSelect: (ply: number) => void }) {
  const { t } = useLanguage();
  const steps = [
    { name: t("В начало", "Go to start", "Ir al inicio"), path: "M6 5v14m11-14-7 7 7 7", next: 0 },
    { name: t("Назад", "Previous move", "Jugada anterior"), path: "m15 5-7 7 7 7", next: ply - 1 },
    { name: t("Вперёд", "Next move", "Jugada siguiente"), path: "m9 5 7 7-7 7", next: ply + 1 },
    { name: t("В конец", "Go to end", "Ir al final"), path: "M18 5v14M7 5l7 7-7 7", next: total },
  ];
  return <div className="replay-buttons">{steps.map(({ name, path, next }) =>
    <button key={path} type="button" aria-label={name} title={name} disabled={next === ply || next < 0 || next > total}
      onClick={() => onSelect(next)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg></button>
  )}</div>;
}
