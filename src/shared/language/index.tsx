import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "ru" | "en" | "es";
const key = "chessboard.language";
const LanguageContext = createContext<{ language: Language; select: (value: Language) => void }>({
  language: "ru", select: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "ru" || saved === "en" || saved === "es") return saved;
    } catch { /* Browser preferences still apply when storage is unavailable. */ }
    if (typeof navigator !== "undefined") {
      for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
        const code = tag?.split("-")[0].toLowerCase();
        if (code === "ru" || code === "en" || code === "es") return code;
      }
    }
    return "ru";
  });
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function select(value: Language) {
    setLanguage(value);
    try { localStorage.setItem(key, value); } catch { /* Keep the selection for this session. */ }
  }
  return <LanguageContext.Provider value={{ language, select }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const { language, select } = useContext(LanguageContext);
  return { language, select, t: (ru: string, en: string, es = en) => ({ ru, en, es })[language] };
}
