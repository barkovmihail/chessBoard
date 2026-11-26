import React, { useEffect, useId, useRef } from "react";
import { NavIcon } from "./NavIcon";

export type PanelName = "inbox" | "feed";
export type PanelView = { open: true; fullPage: true }
  | { open: boolean; fullPage?: false; onToggle: () => void; onClose: () => void };

interface Props {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  title: string;
  regionLabel?: string;
  icon: "swords" | "bell";
  count?: number;
  children: React.ReactNode;
}

export function ToolbarPanel({ open, onToggle, onClose, title, regionLabel, icon, count, children }: Props) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    if (!panel.current?.contains(document.activeElement)) trigger.current?.focus();
    function outside(event: Event) {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) onClose();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [open, onClose]);
  return <div className="current-games" ref={panel} onKeyDown={event => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      onClose();
      trigger.current?.focus();
    }
  }}>
    <button type="button" ref={trigger} className="nav-trigger" title={title}
      aria-expanded={open} aria-controls={id} aria-label={count ? title + " · " + count : title}
      onClick={onToggle}><NavIcon name={icon} />{!!count && <small>{count}</small>}</button>
    <section id={id} hidden={!open} aria-label={regionLabel}>{children}</section>
  </div>;
}
