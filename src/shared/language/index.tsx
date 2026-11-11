import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "ru" | "en";
const key = "chessboard.language";
const LanguageContext = createContext<{ language: Language; select: (value: Language) => void }>({
  language: "ru", select: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, select] = useState<Language>(() => {
    try { return localStorage.getItem(key) === "en" ? "en" : "ru"; }
    catch { return "ru"; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, language); } catch { /* Keep the selection for this session. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, select }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const { language, select } = useContext(LanguageContext);
  return { language, select, t: (ru: string, en: string) => language === "ru" ? ru : en };
}
