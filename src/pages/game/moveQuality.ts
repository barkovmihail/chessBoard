import type { PositionScore } from "./GameReport";

export const qualityLabels = {
  forced: ["→ Вынужденный", "→ Forced", "→ Forzada"],
  strong: ["! Сильный · выбор движка", "! Strong · engine choice", "! Fuerte · elección del motor"],
  recommended: ["✓ Выбор движка", "✓ Engine choice", "✓ Elección del motor"],
  inaccuracy: ["?! Неточность", "?! Inaccuracy", "?! Imprecisión"],
  mistake: ["? Ошибка", "? Mistake", "? Error"],
} as const;

export function moveLoss(before: PositionScore, after: PositionScore, ply: number) {
  return (before.value - after.value) * (ply % 2 ? 1 : -1);
}

export function classifyMove(before: PositionScore | undefined, after: PositionScore | undefined, ply: number, san: string) {
  if (!before || !after) return;
  if (before.legalCount === 1) return "forced";
  const loss = moveLoss(before, after, ply);
  if (before.best === san) {
    if (before.legalCount && before.legalCount > 1 && (before.alternativeGap ?? 0) >= 100 && loss <= 25) return "strong";
    return "recommended";
  }
  if (loss >= 100) return "mistake";
  if (loss >= 50) return "inaccuracy";
}
