import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DICTS, type Lang, formatDate as fmt } from "./dictionaries";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  formatDate: (d: Date | string | null | undefined) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("ppic_lang") as Lang | null;
    if (saved && ["id", "en", "zh"].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("ppic_lang", l);
  };

  const t = (key: string) => DICTS[lang][key] ?? DICTS.id[key] ?? key;
  const formatDate = (d: Date | string | null | undefined) => fmt(d, lang);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, formatDate }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
