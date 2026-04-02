import { DEFAULT_LANGUAGE, SupportedLanguage } from "./index";

export const resolveLanguage = (language?: string): SupportedLanguage =>
  language === "ar" ? "ar" : DEFAULT_LANGUAGE;

export const formatLocalizedDate = (
  value: string | Date,
  language?: string,
  options?: Intl.DateTimeFormatOptions
) =>
  new Intl.DateTimeFormat(resolveLanguage(language), options).format(
    typeof value === "string" ? new Date(value) : value
  );

export const formatLocalizedNumber = (value: number, language?: string) =>
  new Intl.NumberFormat(resolveLanguage(language)).format(value);
