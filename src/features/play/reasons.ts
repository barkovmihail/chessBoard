import type { Language } from "../../shared/language";

export const reasons: Record<string, string> = {
  threefold_repetition: "Троекратное повторение", fifty_moves: "Правило 50 ходов",
  timeout: "Время истекло", resignation: "Сдача", agreement: "Ничья по соглашению", checkmate: "Мат", stalemate: "Пат",
  insufficient_material: "Недостаточно материала", fivefold_repetition: "Пятикратное повторение",
  seventyfive_moves: "Правило 75 ходов",
};

const englishReasons: Record<string, string> = {
  threefold_repetition: "Threefold repetition", fifty_moves: "Fifty-move rule",
  timeout: "Time expired", resignation: "Resignation", agreement: "Draw by agreement",
  checkmate: "Checkmate", stalemate: "Stalemate", insufficient_material: "Insufficient material",
  fivefold_repetition: "Fivefold repetition", seventyfive_moves: "Seventy-five-move rule",
};

const spanishReasons: Record<string, string> = {
  threefold_repetition: "Triple repetición", fifty_moves: "Regla de los 50 movimientos",
  timeout: "Tiempo agotado", resignation: "Abandono", agreement: "Tablas por acuerdo",
  checkmate: "Jaque mate", stalemate: "Ahogado", insufficient_material: "Material insuficiente",
  fivefold_repetition: "Quíntuple repetición", seventyfive_moves: "Regla de los 75 movimientos",
};

export function resultReason(key: string, language: Language) {
  return ({ ru: reasons, en: englishReasons, es: spanishReasons })[language][key] ?? key;
}
