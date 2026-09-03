"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  PLATFORM_FALLBACK_LANGUAGE,
  resolveLanguage,
  resolvePreAuthLanguage,
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

/** Selects pre-auth copy from the browser language without coupling it to region or regulation. */
export function PreAuthI18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    resolvePreAuthLanguage(),
  );

  useEffect(() => {
    setLanguage(resolvePreAuthLanguage(window.navigator.language));
  }, []);

  return <I18nProvider language={language}>{children}</I18nProvider>;
}

/** Client-component translation entry point. */
export function useTranslations(): Translator {
  const language = useContext(LanguageContext);
  return useMemo(() => createTranslator(language), [language]);
}

export function useLanguage(): SupportedLanguage {
  return useContext(LanguageContext);
}
