import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslations from "@/locales/en.json";
import viTranslations from "@/locales/vi.json";

const STORAGE_KEY = "app-language";

const getInitialLanguage = (): string => {
  if (typeof window === "undefined") return "en";

  // Check localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "vi") {
    return stored;
  }

  // Check system preference
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("vi")) {
    return "vi";
  }

  return "en";
};

const initialLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: "en",
  resources: {
    en: { translation: enTranslations },
    vi: { translation: viTranslations },
  },
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

export default i18n;
