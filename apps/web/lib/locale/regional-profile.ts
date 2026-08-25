import {
  CLINIC_REGION_CODES,
  type ClinicRegionCode,
} from "./clinic-regions";

/**
 * Foundation for regional configuration.
 *
 * These dimensions intentionally remain independent: a country supplies a
 * starting profile, but it does not make language, presentation locale,
 * currency, timezone, regulation, or fiscal-provider decisions at runtime.
 * This module is not wired into existing flows yet, so legacy behavior stays
 * unchanged until a later, explicit adoption task.
 */

/** Every profile country is selectable by the practice product. */
export const REGIONAL_PROFILE_COUNTRY_CODES = [...CLINIC_REGION_CODES] as const;

export type RegionalProfileCountryCode =
  (typeof REGIONAL_PROFILE_COUNTRY_CODES)[number];

export const REGIONAL_LANGUAGES = ["en", "es"] as const;
export type RegionalLanguage = (typeof REGIONAL_LANGUAGES)[number];

/**
 * The persisted values are explicitly enumerated. Adding a presentation
 * locale requires a deliberate schema and contract change rather than an
 * unvalidated runtime fallback.
 */
export const REGIONAL_FORMAT_LOCALES = [
  "en-US",
  "en-CA",
  "en-GB",
  "en-IE",
  "en-AU",
  "es-CR",
] as const;
export type FormatLocale = (typeof REGIONAL_FORMAT_LOCALES)[number];
export type CurrencyCode = string;
export type IanaTimeZone = string;

/** Explicit profiles replace country-derived regulatory fallbacks. */
export const REGULATORY_PROFILES = [
  "US_DEA",
  "UK_VMD",
  "CR_NEUTRAL",
  "UNSPECIFIED",
] as const;
export type RegulatoryProfile = (typeof REGULATORY_PROFILES)[number];

/** `none` is the only configured provider today. Extend this union explicitly. */
export const FISCAL_PROVIDERS = ["none"] as const;
export type FiscalProvider = (typeof FISCAL_PROVIDERS)[number];

export interface PracticeRegionalProfile {
  countryCode: RegionalProfileCountryCode;
  language: RegionalLanguage;
  formatLocale: FormatLocale;
  currencyCode: CurrencyCode;
  timezone: IanaTimeZone;
  regulatoryProfile: RegulatoryProfile;
  fiscalProvider: FiscalProvider;
}

export interface RegionalCatalogEntry extends PracticeRegionalProfile {
  countryName: string;
  currency: {
    code: string;
    name: string;
    symbol: string;
  };
  phoneCountryCode: string;
}

/**
 * The persisted shape intentionally mirrors the practice columns. It keeps
 * storage reconstruction separate from country defaults, so a tenant can use
 * an independent language, currency, or regulatory profile.
 */
export interface PersistedPracticeRegionalFields {
  country: string | null | undefined;
  currency: string | null | undefined;
  timezone: string | null | undefined;
  language: string | null | undefined;
  formatLocale: string | null | undefined;
  regulatoryProfile: string | null | undefined;
  fiscalProvider: string | null | undefined;
}

const REGIONAL_PROFILE_DEFAULTS: Readonly<
  Record<RegionalProfileCountryCode, PracticeRegionalProfile>
> = {
  US: {
    countryCode: "US",
    language: "en",
    formatLocale: "en-US",
    currencyCode: "usd",
    timezone: "America/New_York",
    regulatoryProfile: "US_DEA",
    fiscalProvider: "none",
  },
  CA: {
    countryCode: "CA",
    language: "en",
    formatLocale: "en-CA",
    currencyCode: "cad",
    timezone: "America/Toronto",
    regulatoryProfile: "US_DEA",
    fiscalProvider: "none",
  },
  GB: {
    countryCode: "GB",
    language: "en",
    formatLocale: "en-GB",
    currencyCode: "gbp",
    timezone: "Europe/London",
    regulatoryProfile: "UK_VMD",
    fiscalProvider: "none",
  },
  IE: {
    countryCode: "IE",
    language: "en",
    formatLocale: "en-IE",
    currencyCode: "eur",
    timezone: "Europe/Dublin",
    regulatoryProfile: "US_DEA",
    fiscalProvider: "none",
  },
  AU: {
    countryCode: "AU",
    language: "en",
    formatLocale: "en-AU",
    currencyCode: "aud",
    timezone: "Australia/Sydney",
    regulatoryProfile: "US_DEA",
    fiscalProvider: "none",
  },
  CR: {
    countryCode: "CR",
    language: "es",
    formatLocale: "es-CR",
    currencyCode: "crc",
    timezone: "America/Costa_Rica",
    regulatoryProfile: "CR_NEUTRAL",
    fiscalProvider: "none",
  },
};

/**
 * Presentation metadata for the regional catalog. Currency `code` is the
 * uppercase ISO form; profile `currencyCode` preserves the lowercase
 * Stripe-compatible convention used by the existing application storage.
 */
const REGIONAL_CATALOG_METADATA: Readonly<
  Record<RegionalProfileCountryCode, Omit<RegionalCatalogEntry, keyof PracticeRegionalProfile>>
> = {
  US: {
    countryName: "United States",
    currency: { code: "USD", name: "US dollar", symbol: "$" },
    phoneCountryCode: "+1",
  },
  CA: {
    countryName: "Canada",
    currency: { code: "CAD", name: "Canadian dollar", symbol: "$" },
    phoneCountryCode: "+1",
  },
  GB: {
    countryName: "United Kingdom",
    currency: { code: "GBP", name: "Pound sterling", symbol: "£" },
    phoneCountryCode: "+44",
  },
  IE: {
    countryName: "Ireland",
    currency: { code: "EUR", name: "Euro", symbol: "€" },
    phoneCountryCode: "+353",
  },
  AU: {
    countryName: "Australia",
    currency: { code: "AUD", name: "Australian dollar", symbol: "A$" },
    phoneCountryCode: "+61",
  },
  CR: {
    countryName: "Costa Rica",
    currency: {
      code: "CRC",
      name: "Colón costarricense",
      symbol: "₡",
    },
    phoneCountryCode: "+506",
  },
};

export function isRegionalProfileCountryCode(
  value: string,
): value is RegionalProfileCountryCode {
  return REGIONAL_PROFILE_COUNTRY_CODES.includes(
    value as RegionalProfileCountryCode,
  );
}

export function isRegionalLanguage(value: string): value is RegionalLanguage {
  return REGIONAL_LANGUAGES.includes(value as RegionalLanguage);
}

export function isRegionalFormatLocale(value: string): value is FormatLocale {
  return REGIONAL_FORMAT_LOCALES.includes(value as FormatLocale);
}

export function isRegulatoryProfile(value: string): value is RegulatoryProfile {
  return REGULATORY_PROFILES.includes(value as RegulatoryProfile);
}

export function isFiscalProvider(value: string): value is FiscalProvider {
  return FISCAL_PROVIDERS.includes(value as FiscalProvider);
}

function isSupportedIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a copy so callers can independently override one dimension without
 * mutating the shared defaults. Unknown countries deliberately have no
 * profile: they never fall back to a regulatory framework implicitly.
 */
export function regionalProfileDefaultsForCountry(
  countryCode: string | null | undefined,
): PracticeRegionalProfile | null {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || !isRegionalProfileCountryCode(normalized)) return null;
  return { ...REGIONAL_PROFILE_DEFAULTS[normalized] };
}

export function regionalCatalogEntryForCountry(
  countryCode: string | null | undefined,
): RegionalCatalogEntry | null {
  const profile = regionalProfileDefaultsForCountry(countryCode);
  if (!profile) return null;
  return { ...profile, ...REGIONAL_CATALOG_METADATA[profile.countryCode] };
}

/**
 * Compatibility helper for a later adoption task. It derives only from the
 * existing selectable-country type and does not change any active code path.
 */
export function legacyRegionalProfileDefaults(
  countryCode: ClinicRegionCode,
): PracticeRegionalProfile {
  return { ...REGIONAL_PROFILE_DEFAULTS[countryCode] };
}

/**
 * Reconstructs a practice profile only from persisted dimensions. Country is
 * validated solely as the profile identity; it never derives regulation or
 * any other stored value. Unknown countries deliberately return null.
 */
export function practiceRegionalProfileFromPersisted(
  fields: PersistedPracticeRegionalFields,
): PracticeRegionalProfile | null {
  const countryCode = fields.country?.trim().toUpperCase();
  const currencyCode = fields.currency?.trim().toLowerCase();
  const timezone = fields.timezone?.trim();
  const language = fields.language?.trim();
  const formatLocale = fields.formatLocale?.trim();
  const regulatoryProfile = fields.regulatoryProfile?.trim();
  const fiscalProvider = fields.fiscalProvider?.trim();

  if (
    !countryCode ||
    !isRegionalProfileCountryCode(countryCode) ||
    !currencyCode ||
    !/^[a-z]{3}$/.test(currencyCode) ||
    !timezone ||
    !isSupportedIanaTimeZone(timezone) ||
    !language ||
    !isRegionalLanguage(language) ||
    !formatLocale ||
    !isRegionalFormatLocale(formatLocale) ||
    !regulatoryProfile ||
    !isRegulatoryProfile(regulatoryProfile) ||
    !fiscalProvider ||
    !isFiscalProvider(fiscalProvider)
  ) {
    return null;
  }

  return {
    countryCode,
    currencyCode,
    timezone,
    language,
    formatLocale,
    regulatoryProfile,
    fiscalProvider,
  };
}

/** Build an independent profile value without persisting or validating it. */
export function withRegionalProfileOverrides(
  profile: PracticeRegionalProfile,
  overrides: Partial<PracticeRegionalProfile>,
): PracticeRegionalProfile {
  return { ...profile, ...overrides };
}
