import type { SupportedLanguage } from "./language";
import { enAuthMessages, esAuthMessages } from "./messages/auth";
import { enCommonMessages, esCommonMessages } from "./messages/common";

export const enMessages = {
  ...enCommonMessages,
  ...enAuthMessages,
} as const;

export type TranslationKey = keyof typeof enMessages;

type LocalizedMessages = Partial<Record<TranslationKey, string>>;

const messages: Record<SupportedLanguage, LocalizedMessages> = {
  en: enMessages,
  es: {
    ...esCommonMessages,
    ...esAuthMessages,
  },
};

/**
 * English is the complete canonical catalog. A missing localized entry falls
 * back to English; an unknown key is returned as its identifier for diagnosable
 * safe rendering instead of producing an empty user-facing string.
 */
export function translate(language: SupportedLanguage, key: string): string {
  const localized = messages[language][key as TranslationKey];
  if (localized) return localized;

  return enMessages[key as TranslationKey] ?? key;
}

export type Translator = (key: TranslationKey) => string;

export function createTranslator(language: SupportedLanguage): Translator {
  return (key) => translate(language, key);
}
