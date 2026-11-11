export const levelLabels = {
  easy: ["1 · Слабый", "1 · Weak", "1 · Débil"],
  casual: ["2 · Умеренный", "2 · Casual", "2 · Moderado"],
  normal: ["3 · Средний", "3 · Medium", "3 · Intermedio"],
  strong: ["4 · Сильный", "4 · Strong", "4 · Fuerte"],
  expert: ["5 · Эксперт", "5 · Expert", "5 · Experto"],
} as const;

export type EngineLevel = keyof typeof levelLabels;

export function isEngineLevel(value: unknown): value is EngineLevel {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(levelLabels, value);
}
