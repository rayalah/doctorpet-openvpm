import type { SupportedLanguage } from "./language";
import { enAuthMessages, esAuthMessages } from "./messages/auth";
import { enCommonMessages, esCommonMessages } from "./messages/common";
import { enDashboardMessages, esDashboardMessages } from "./messages/dashboard";
import { enNavigationMessages, esNavigationMessages } from "./messages/navigation";
import { enWelcomeMessages, esWelcomeMessages } from "./messages/welcome";

export const enMessages = {
  ...enCommonMessages,
  ...enAuthMessages,
  ...enNavigationMessages,
  ...enDashboardMessages,
  ...enWelcomeMessages,
} as const;

export type TranslationKey = keyof typeof enMessages;

type LocalizedMessages = Partial<Record<TranslationKey, string>>;

const messages: Record<SupportedLanguage, LocalizedMessages> = {
  en: enMessages,
  es: {
    ...esCommonMessages,
    ...esAuthMessages,
    ...esNavigationMessages,
    ...esDashboardMessages,
    ...esWelcomeMessages,
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
