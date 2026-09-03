/**
 * UI language is intentionally independent from formatting locale, country,
 * currency, timezone, and regulatory profile.
 */
export const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const PLATFORM_FALLBACK_LANGUAGE: SupportedLanguage = "en";

export type LanguagePreference = {
  language?: string | null;
};

export function isSupportedLanguage(
  value: unknown,
): value is SupportedLanguage {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export function resolveLanguage(value: unknown): SupportedLanguage {
  return isSupportedLanguage(value) ? value : PLATFORM_FALLBACK_LANGUAGE;
}

/**
 * Uses the persisted practice setting after authentication. Callers must pass
 * only the language field; this resolver must not infer language from another
 * regional dimension.
 */
export function resolveAuthenticatedPracticeLanguage(
  practice: LanguagePreference | null | undefined,
): SupportedLanguage {
  return resolveLanguage(practice?.language);
}

/**
 * Date labels follow the selected UI language. This is deliberately separate
 * from the practice's country, currency, timezone, and regional profile.
 */
export function dateLocaleForLanguage(language: SupportedLanguage): string {
  return language === "es" ? "es" : "en-US";
}

/**
 * Public tenant routes use the tenant's explicit language when it is available.
 */
export function resolvePublicTenantLanguage(
  tenant: LanguagePreference | null | undefined,
): SupportedLanguage {
  return resolveLanguage(tenant?.language);
}

/**
 * Login and other pre-auth routes do not yet have a trustworthy tenant context.
 */
export function resolvePreAuthLanguage(
  browserLanguage?: unknown,
): SupportedLanguage {
  if (typeof browserLanguage === "string") {
    return resolveLanguage(browserLanguage.trim().toLowerCase().split("-")[0]);
  }
  return PLATFORM_FALLBACK_LANGUAGE;
}
