import { create } from "zustand";
import i18n from "@/i18n/config";

type Language = "en" | "vi";

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
}

const STORAGE_KEY = "app-language";

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: (localStorage.getItem(STORAGE_KEY) as Language) || "en",
  setLanguage: (language: Language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, language);
    }
    i18n.changeLanguage(language);
    set({ language });
  },
}));
