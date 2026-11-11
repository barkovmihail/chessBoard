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

export function resultReason(key: string, language: "ru" | "en") {
  return (language === "ru" ? reasons : englishReasons)[key] ?? key;
}
