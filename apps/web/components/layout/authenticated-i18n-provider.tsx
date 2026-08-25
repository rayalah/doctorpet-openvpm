"use client";

import { I18nProvider } from "@/lib/i18n/client";
import { resolveAuthenticatedPracticeLanguage } from "@/lib/i18n/language";
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

  return (
    <I18nProvider language={resolveAuthenticatedPracticeLanguage(practice.data)}>
      {children}
    </I18nProvider>
  );
}
