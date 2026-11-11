export interface Lesson {
  id: string;
  name: string;
  side: "w" | "b";
  idea: string;
  steps: [string, string][];
}

function buildLessons(t: (ru: string, en: string) => string): Lesson[] {
  return [
    { id: "italian-game", name: t("Итальянская партия", "Italian Game"), side: "w", idea: t("Развить слона на c4 и подготовить пешечный центр.", "Develop the bishop to c4 and prepare to build a pawn center."), steps: [
      ["e4", t("Пешка занимает центр и открывает диагональ слону f1.", "The pawn takes central space and opens a diagonal for the f1 bishop.")],
      ["e5", t("Чёрные занимают симметричную долю центра.", "Black claims an equal share of the center.")],
      ["Nf3", t("Конь нападает на e5 и приближает рокировку.", "The knight attacks e5 and prepares to castle.")],
      ["Nc6", t("Конь защищает пешку e5.", "The knight defends the e5 pawn.")],
      ["Bc4", t("Слон смотрит на слабое поле f7 возле короля.", "The bishop eyes the weak f7 square next to the king.")],
      ["Bc5", t("Чёрный слон тоже занимает активную диагональ.", "Black’s bishop also takes an active diagonal.")],
      ["c3", t("Пешка c3 готовит продвижение d2–d4.", "The c3 pawn supports the d2–d4 advance.")],
    ] },
    { id: "ruy-lopez", name: t("Испанская партия", "Ruy Lopez"), side: "w", idea: t("Создать давление на коня, который защищает пешку e5.", "Put pressure on the knight defending the e5 pawn."), steps: [
      ["e4", t("Белые занимают центр королевской пешкой.", "White claims the center with the king’s pawn.")], ["e5", t("Чёрные борются за поле d4.", "Black contests d4.")],
      ["Nf3", t("Конь атакует пешку e5.", "The knight attacks the e5 pawn.")], ["Nc6", t("Конь с b8 защищает e5.", "The b8 knight defends e5.")],
      ["Bb5", t("Слон нападает на защитника пешки e5.", "The bishop attacks the defender of the e5 pawn.")], ["a6", t("Чёрные спрашивают слона, куда он отступит.", "The a6 pawn attacks the bishop and makes it choose a retreat.")],
      ["Ba4", t("Слон сохраняет давление на коня c6.", "The bishop keeps pressure on the c6 knight.")],
    ] },
    { id: "queens-gambit", name: t("Ферзевый гамбит", "Queen’s Gambit"), side: "w", idea: t("Подорвать пешку d5 с фланга и усилить контроль центра.", "Attack the d5 pawn from the flank to gain more control of the center."), steps: [
      ["d4", t("Пешка занимает d4 и контролирует e5.", "The pawn occupies d4 and controls e5.")], ["d5", t("Чёрные закрепляются в центре.", "Black establishes a foothold in the center.")],
      ["c4", t("Белые предлагают пешку c4, чтобы отвлечь пешку d5.", "White offers the c4 pawn to draw Black’s pawn away from d5.")], ["e6", t("Чёрные поддерживают d5 и отклоняют гамбит.", "Black reinforces d5 and declines the gambit.")],
      ["Nc3", t("Конь усиливает давление на d5.", "The knight adds pressure on d5.")], ["Nf6", t("Чёрные выводят коня и прикрывают d5.", "Black develops a knight and defends d5.")],
      ["Bg5", t("Слон связывает коня f6 с ферзём d8.", "The bishop pins the f6 knight to the queen on d8.")],
    ] },
    { id: "sicilian-defense", name: t("Сицилианская защита", "Sicilian Defense"), side: "b", idea: t("Ответить на e4 фланговой пешкой и разменять её на центральную.", "Meet e4 with a flank pawn and trade it for a central pawn."), steps: [
      ["e4", t("Белые занимают центр.", "White takes space in the center.")], ["c5", t("Пешка с фланга контролирует поле d4.", "The flank pawn controls d4.")],
      ["Nf3", t("Конь поддерживает прорыв d4.", "The knight supports the d4 break.")], ["d6", t("Пешка контролирует e5 и открывает слону c8 диагональ.", "The pawn controls e5 and opens a diagonal for the c8 bishop.")],
      ["d4", t("Белые вскрывают центр.", "White opens the center.")], ["cxd4", t("Пешка c5 забирает центральную пешку белых.", "The c5 pawn captures White’s central pawn.")],
      ["Nxd4", t("Конь белых возвращает материал.", "White’s knight recovers the material.")], ["Nf6", t("Чёрные развивают коня с нападением на e4.", "Black develops a knight with an attack on e4.")],
    ] },
    { id: "french-defense", name: t("Французская защита", "French Defense"), side: "b", idea: t("Построить цепь e6–d5 и атаковать основание белого центра.", "Build an e6–d5 pawn chain and attack the base of White’s center."), steps: [
      ["e4", t("Белые открывают диагональ королевского слона.", "White opens a diagonal for the king’s bishop.")], ["e6", t("Пешка поддержит продвижение d7–d5.", "The pawn prepares the d7–d5 advance.")],
      ["d4", t("Белые занимают центр двумя пешками.", "White occupies the center with two pawns.")], ["d5", t("Чёрные сразу атакуют пешку e4.", "Black immediately attacks the e4 pawn.")],
      ["e5", t("Белые занимают пространство и закрывают центр.", "White gains space and closes the center.")], ["c5", t("Чёрные атакуют пешку d4, основание белой цепи.", "Black attacks d4, the base of White’s pawn chain.")],
      ["c3", t("Белые укрепляют d4.", "White reinforces d4.")], ["Nc6", t("Конь добавляет давление на d4.", "The knight adds pressure on d4.")],
    ] },
  ];
}

export const lessonsByLanguage = {
  ru: buildLessons(ru => ru),
  en: buildLessons((_ru, en) => en),
};
