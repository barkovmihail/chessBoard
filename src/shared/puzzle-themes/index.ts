import { useLanguage } from "../language";

export function usePuzzleThemes(): Record<string, string> {
  const { t } = useLanguage();
  return {
    "": t("Все темы", "All themes", "Todos los temas"), mateIn1: t("Мат в один ход", "Mate in one", "Mate en una"),
    mateIn2: t("Мат в два хода", "Mate in two", "Mate en dos"), fork: t("Вилка", "Fork", "Ataque doble"),
    pin: t("Связка", "Pin", "Clavada"), endgame: t("Эндшпиль", "Endgame", "Final"),
  };
}
