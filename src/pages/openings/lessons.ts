export interface Lesson {
  id: string;
  name: string;
  side: "w" | "b";
  idea: string;
  steps: [string, string][];
}

function buildLessons(t: (ru: string, en: string, es: string) => string): Lesson[] {
  return [
    { id: "italian-game", name: t("Итальянская партия", "Italian Game", "Apertura italiana"), side: "w", idea: t("Развить слона на c4 и подготовить пешечный центр.", "Develop the bishop to c4 and prepare to build a pawn center.", "Desarrolla el alfil por c4 y prepara un centro de peones."), steps: [
      ["e4", t("Пешка занимает центр и открывает диагональ слону f1.", "The pawn takes central space and opens a diagonal for the f1 bishop.", "El peón ocupa el centro y abre una diagonal para el alfil de f1.")],
      ["e5", t("Чёрные занимают симметричную долю центра.", "Black claims an equal share of the center.", "Las negras también ocupan el centro con un peón.")],
      ["Nf3", t("Конь нападает на e5 и приближает рокировку.", "The knight attacks e5 and prepares to castle.", "El caballo ataca e5 y prepara el enroque.")],
      ["Nc6", t("Конь защищает пешку e5.", "The knight defends the e5 pawn.", "El caballo defiende el peón de e5.")],
      ["Bc4", t("Слон смотрит на слабое поле f7 возле короля.", "The bishop eyes the weak f7 square next to the king.", "El alfil apunta a f7, la casilla débil junto al rey.")],
      ["Bc5", t("Чёрный слон тоже занимает активную диагональ.", "Black’s bishop also takes an active diagonal.", "El alfil negro también ocupa una diagonal activa.")],
      ["c3", t("Пешка c3 готовит продвижение d2–d4.", "The c3 pawn supports the d2–d4 advance.", "El peón de c3 prepara el avance d2–d4.")],
    ] },
    { id: "ruy-lopez", name: t("Испанская партия", "Ruy Lopez", "Apertura española"), side: "w", idea: t("Создать давление на коня, который защищает пешку e5.", "Put pressure on the knight defending the e5 pawn.", "Presiona al caballo que defiende el peón de e5."), steps: [
      ["e4", t("Белые занимают центр королевской пешкой.", "White claims the center with the king’s pawn.", "Las blancas ocupan el centro con el peón de rey.")], ["e5", t("Чёрные борются за поле d4.", "Black contests d4.", "Las negras disputan el control de d4.")],
      ["Nf3", t("Конь атакует пешку e5.", "The knight attacks the e5 pawn.", "El caballo ataca el peón de e5.")], ["Nc6", t("Конь с b8 защищает e5.", "The b8 knight defends e5.", "El caballo de b8 defiende e5.")],
      ["Bb5", t("Слон нападает на защитника пешки e5.", "The bishop attacks the defender of the e5 pawn.", "El alfil ataca al defensor del peón de e5.")], ["a6", t("Чёрные спрашивают слона, куда он отступит.", "The a6 pawn attacks the bishop and makes it choose a retreat.", "El peón de a6 ataca al alfil y lo obliga a decidir si cambia o se retira.")],
      ["Ba4", t("Слон сохраняет давление на коня c6.", "The bishop keeps pressure on the c6 knight.", "El alfil mantiene la presión sobre el caballo de c6.")],
    ] },
    { id: "queens-gambit", name: t("Ферзевый гамбит", "Queen’s Gambit", "Gambito de dama"), side: "w", idea: t("Подорвать пешку d5 с фланга и усилить контроль центра.", "Attack the d5 pawn from the flank to gain more control of the center.", "Ataca el peón de d5 desde el flanco para reforzar el control del centro."), steps: [
      ["d4", t("Пешка занимает d4 и контролирует e5.", "The pawn occupies d4 and controls e5.", "El peón ocupa d4 y controla e5.")], ["d5", t("Чёрные закрепляются в центре.", "Black establishes a foothold in the center.", "Las negras se afianzan en el centro.")],
      ["c4", t("Белые предлагают пешку c4, чтобы отвлечь пешку d5.", "White offers the c4 pawn to draw Black’s pawn away from d5.", "Las blancas ofrecen el peón de c4 para desviar al peón de d5.")], ["e6", t("Чёрные поддерживают d5 и отклоняют гамбит.", "Black reinforces d5 and declines the gambit.", "Las negras refuerzan d5 y rehúsan el gambito.")],
      ["Nc3", t("Конь усиливает давление на d5.", "The knight adds pressure on d5.", "El caballo aumenta la presión sobre d5.")], ["Nf6", t("Чёрные выводят коня и прикрывают d5.", "Black develops a knight and defends d5.", "Las negras desarrollan el caballo y defienden d5.")],
      ["Bg5", t("Слон связывает коня f6 с ферзём d8.", "The bishop pins the f6 knight to the queen on d8.", "El alfil clava el caballo de f6 contra la dama de d8.")],
    ] },
    { id: "sicilian-defense", name: t("Сицилианская защита", "Sicilian Defense", "Defensa siciliana"), side: "b", idea: t("Ответить на e4 фланговой пешкой и разменять её на центральную.", "Meet e4 with a flank pawn and trade it for a central pawn.", "Responde a e4 con un peón de flanco y cámbialo por un peón central."), steps: [
      ["e4", t("Белые занимают центр.", "White takes space in the center.", "Las blancas ganan espacio en el centro.")], ["c5", t("Пешка с фланга контролирует поле d4.", "The flank pawn controls d4.", "El peón de flanco controla d4.")],
      ["Nf3", t("Конь поддерживает прорыв d4.", "The knight supports the d4 break.", "El caballo apoya la ruptura d4.")], ["d6", t("Пешка контролирует e5 и открывает слону c8 диагональ.", "The pawn controls e5 and opens a diagonal for the c8 bishop.", "El peón controla e5 y abre una diagonal para el alfil de c8.")],
      ["d4", t("Белые вскрывают центр.", "White opens the center.", "Las blancas abren el centro.")], ["cxd4", t("Пешка c5 забирает центральную пешку белых.", "The c5 pawn captures White’s central pawn.", "El peón de c5 captura el peón central de las blancas.")],
      ["Nxd4", t("Конь белых возвращает материал.", "White’s knight recovers the material.", "El caballo blanco recupera el material.")], ["Nf6", t("Чёрные развивают коня с нападением на e4.", "Black develops a knight with an attack on e4.", "Las negras desarrollan el caballo con un ataque a e4.")],
    ] },
    { id: "french-defense", name: t("Французская защита", "French Defense", "Defensa francesa"), side: "b", idea: t("Построить цепь e6–d5 и атаковать основание белого центра.", "Build an e6–d5 pawn chain and attack the base of White’s center.", "Forma la cadena de peones e6–d5 y ataca la base del centro blanco."), steps: [
      ["e4", t("Белые открывают диагональ королевского слона.", "White opens a diagonal for the king’s bishop.", "Las blancas abren una diagonal para el alfil de rey.")], ["e6", t("Пешка поддержит продвижение d7–d5.", "The pawn prepares the d7–d5 advance.", "El peón prepara el avance d7–d5.")],
      ["d4", t("Белые занимают центр двумя пешками.", "White occupies the center with two pawns.", "Las blancas ocupan el centro con dos peones.")], ["d5", t("Чёрные сразу атакуют пешку e4.", "Black immediately attacks the e4 pawn.", "Las negras atacan de inmediato el peón de e4.")],
      ["e5", t("Белые занимают пространство и закрывают центр.", "White gains space and closes the center.", "Las blancas ganan espacio y cierran el centro.")], ["c5", t("Чёрные атакуют пешку d4, основание белой цепи.", "Black attacks d4, the base of White’s pawn chain.", "Las negras atacan d4, la base de la cadena de peones blanca.")],
      ["c3", t("Белые укрепляют d4.", "White reinforces d4.", "Las blancas refuerzan d4.")], ["Nc6", t("Конь добавляет давление на d4.", "The knight adds pressure on d4.", "El caballo aumenta la presión sobre d4.")],
    ] },
  ];
}

export const lessonsByLanguage = {
  ru: buildLessons(ru => ru),
  en: buildLessons((_ru, en) => en),
  es: buildLessons((_ru, _en, es) => es),
};
