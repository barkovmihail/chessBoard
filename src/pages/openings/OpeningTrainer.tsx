import React, { useRef, useState } from "react";
import { Trainer } from "../../features/training";
import { useLanguage } from "../../shared/language";

type Props = React.ComponentProps<typeof Trainer> & { chapterId: string; line: number };

interface Position {
  chapter: string; line: number; ply: number; fen: string; expected: string; side: "w" | "b";
}

export function OpeningTrainer({ chapterId, line, context, ...trainer }: Props) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState<Position[]>([]);
  const [savedPly, setSavedPly] = useState<number>();
  const queue = useRef(Promise.resolve());

  function save(position: Position) {
    queue.current = queue.current.then(async () => {
      try {
        const response = await fetch("/api/openings/positions", { method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(position) });
        if (!response.ok) throw Error();
        setSavedPly(position.ply);
        setFailed(previous => previous.filter(item => item.ply !== position.ply));
      } catch {
        setFailed(previous => previous.some(item => item.ply === position.ply) ? previous : [...previous, position]);
      }
    });
  }

  return <Trainer {...trainer} onMistake={(ply, fen, expected) => {
    save({ chapter: chapterId, line, ply, fen, expected, side: trainer.side });
  }} context={<>{context}
    {savedPly !== undefined && <p role="status">{t("Для повторения сохранена позиция перед полуходом", "Saved for review: position before half-move", "Posición guardada para repasar antes de la media jugada")} {savedPly + 1}.</p>}
    {failed.length > 0 && <p role="alert">{t("Не удалось сохранить позицию.", "Could not save the position.", "No se pudo guardar la posición.")} <button onClick={() => failed.forEach(save)}>{t("Повторить сохранение", "Retry saving", "Volver a guardar")}</button></p>}
  </>} />;
}
