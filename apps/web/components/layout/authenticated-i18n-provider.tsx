"use client";

import { I18nProvider } from "@/lib/i18n/client";
import {
  DOCTOR_PET_INITIAL_LANGUAGE,
  resolveAuthenticatedPracticeLanguage,
} from "@/lib/i18n/language";
import { trpc } from "@/lib/trpc";

/**
 * The protected procedure resolves the active practice from the server-side
 * session. This component never accepts a client-controlled tenant language.
 */
export function AuthenticatedI18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const practice = trpc.settings.getPractice.useQuery(undefined, {
    retry: false,
  });
  const language = practice.data
    ? resolveAuthenticatedPracticeLanguage(practice.data)
    : DOCTOR_PET_INITIAL_LANGUAGE;

  return (
    <I18nProvider language={language}>{children}</I18nProvider>
  );
}
