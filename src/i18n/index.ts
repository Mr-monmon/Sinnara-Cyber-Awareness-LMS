import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import commonAr from "../locales/ar/common.json";
import employeeAr from "../locales/ar/employee.json";
import commonEn from "../locales/en/common.json";
import employeeEn from "../locales/en/employee.json";

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "ar"] as const;
export const LANGUAGE_STORAGE_KEY = "app-language";

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: {
    common: commonEn,
    employee: employeeEn,
  },
  ar: {
    common: commonAr,
    employee: employeeAr,
  },
} as const;

const isSupportedLanguage = (language: string): language is SupportedLanguage =>
  SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);

const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage && isSupportedLanguage(storedLanguage)) {
    return storedLanguage;
  }

  const browserLanguage = window.navigator.language.split("-")[0];
  return isSupportedLanguage(browserLanguage)
    ? browserLanguage
    : DEFAULT_LANGUAGE;
};

export const getDirection = (language: string) =>
  language === "ar" ? "rtl" : "ltr";

const syncDocumentLanguage = (language: string) => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = language;
  document.documentElement.dir = getDirection(language);
};

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  defaultNS: "common",
  ns: ["common", "employee"],
  interpolation: {
    escapeValue: false,
  },
});

syncDocumentLanguage(i18n.resolvedLanguage || DEFAULT_LANGUAGE);

i18n.on("languageChanged", (language) => {
  syncDocumentLanguage(language);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
});

export default i18n;
