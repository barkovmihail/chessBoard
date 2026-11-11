export const levelLabels = {
  easy: ["1 · Слабый", "1 · Weak"],
  casual: ["2 · Умеренный", "2 · Casual"],
  normal: ["3 · Средний", "3 · Medium"],
  strong: ["4 · Сильный", "4 · Strong"],
  expert: ["5 · Эксперт", "5 · Expert"],
} as const;

export type EngineLevel = keyof typeof levelLabels;

export function isEngineLevel(value: unknown): value is EngineLevel {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(levelLabels, value);
}
