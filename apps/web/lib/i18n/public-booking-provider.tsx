"use client";

import { I18nProvider } from "./client";
import {
  DOCTOR_PET_INITIAL_LANGUAGE,
  resolvePublicTenantLanguage,
} from "./language";
import { trpc } from "@/lib/trpc";

/** Public tenant copy follows the published practice, never device locale. */
export function PublicBookingI18nProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const page = trpc.booking.getPage.useQuery(
    { slug },
    { enabled: Boolean(slug), retry: false },
  );
  const language = page.data
    ? resolvePublicTenantLanguage(page.data.practice, DOCTOR_PET_INITIAL_LANGUAGE)
    : DOCTOR_PET_INITIAL_LANGUAGE;

  return <I18nProvider language={language}>{children}</I18nProvider>;
}
