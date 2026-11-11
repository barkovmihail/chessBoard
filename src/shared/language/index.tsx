import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "ru" | "en" | "es";
const key = "chessboard.language";
const LanguageContext = createContext<{ language: Language; select: (value: Language) => void }>({
  language: "ru", select: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, select] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === "en" || saved === "es" ? saved : "ru";
    }
    catch { return "ru"; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(key, language); } catch { /* Keep the selection for this session. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, select }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const { language, select } = useContext(LanguageContext);
  return { language, select, t: (ru: string, en: string, es = en) => ({ ru, en, es })[language] };
}
