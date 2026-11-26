import React, { useId, useRef } from "react";
import { useLanguage } from "../language";

interface Props {
  label: string;
  question: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
}

export function ConfirmAction({ label, question, description, onConfirm, disabled }: Props) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return <>
    <button type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>{label}</button>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby={title} aria-describedby={title + "-description"}>
      <h2 id={title}>{question}</h2>
      <p id={title + "-description"}>{description}</p>
      <div className="confirm-actions">
        <button type="button" onClick={() => dialog.current?.close()}>{t("Отмена", "Cancel", "Cancelar")}</button>
        <button type="button" className="atlas-primary" disabled={disabled} onClick={() => {
          dialog.current?.close();
          onConfirm();
        }}>{label}</button>
      </div>
    </dialog>
  </>;
}
