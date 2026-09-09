"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DOCTOR_PET_INITIAL_LANGUAGE,
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
  const resolvedLanguage = resolveLanguage(language);

  useEffect(() => {
    document.documentElement.lang = resolvedLanguage;
  }, [resolvedLanguage]);

  return (
    <LanguageContext.Provider value={resolvedLanguage}>
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
  // The server cannot read navigator.language. Start from the same Doctor Pet
  // default on both sides, then honor the browser after hydration.
  const [language, setLanguage] = useState<SupportedLanguage>(
    DOCTOR_PET_INITIAL_LANGUAGE,
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
