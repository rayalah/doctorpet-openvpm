"use client";

import React, { createContext, useContext } from "react";
import {
  PLATFORM_FALLBACK_LANGUAGE,
  resolveLanguage,
  type SupportedLanguage,
} from "./language";
import { createTranslator, type Translator } from "./messages";

const LanguageContext = createContext<SupportedLanguage>(
  PLATFORM_FALLBACK_LANGUAGE,
);

export function I18nProvider({
  children,
  language,
}: {
  children: React.ReactNode;
  language?: unknown;
}) {
  return (
    <LanguageContext.Provider value={resolveLanguage(language)}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Client-component translation entry point. */
export function useTranslations(): Translator {
  return createTranslator(useContext(LanguageContext));
}

export function useLanguage(): SupportedLanguage {
  return useContext(LanguageContext);
}
