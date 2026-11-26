import React from "react";

const paths = {
  mail: "M3 5h18v14H3z M3 6l9 7 9-7",
  team: "M12 20H2v-3q1-5 5-5t5 5z M15 13q6-2 7 4v3h-7 M10 7a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M19 7a3 3 0 1 1-6 0 3 3 0 1 1 6 0",
  settings: "M3 7h8m5 0h5 M3 17h3m5 0h10 M15 7a2 2 0 1 1-4 0 2 2 0 1 1 4 0 M10 17a2 2 0 1 1-4 0 2 2 0 1 1 4 0",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0 M12 1v3m11 8h-3M12 23v-3M1 12h3m2-6 2 2m10-2-2 2m2 10-2-2M6 18l2-2",
  moon: "M19 16A9 9 0 0 1 8 4a9 9 0 1 0 11 12z",
  board: "M3 3h18v18H3z M3 12h18 M12 3v18 M4 4h7v7H4z M13 13h7v7h-7z",
  book: "M12 6Q7 3 2 5v14q5-2 10 1 5-3 10-1V5q-5-2-10 1v14",
  puzzle: "M4 6h5a3 3 0 1 1 6 0h4v5a3 3 0 1 0 0 6v3H4v-5a3 3 0 1 0 0-6z",
  chart: "M3 3v17h18 M6 15l4-5 4 2 6-8",
  cup: "M7 3h10v5a5 5 0 0 1-10 0z M7 5H3v2a4 4 0 0 0 5 4 M17 5h4v2a4 4 0 0 1-5 4 M12 13v6 M7 21h10",
  chat: "M21 11a8 8 0 0 1-8 8H8l-5 3 1.2-5A8 8 0 0 1 3 12v-1a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z",
  swords: "M3 3l4 1 12 14-1 1L4 7z M3 21l4-4 M21 21l-4-4 M3 15l6 6 M15 21l6-6 M14 9l3-5 4-1-1 4-4 4 M10 14l-3 4",
  bell: "M4 17h16l-2-3V9a6 6 0 0 0-12 0v5z M10 20q2 3 4 0",
  account: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M6 18q6-8 12 0",
};

export function NavIcon({ name }: { name: keyof typeof paths }) {
  return <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
