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

/** Costa Rica is representable here before it is selectable by the product. */
export const REGIONAL_PROFILE_COUNTRY_CODES = [
  ...CLINIC_REGION_CODES,
  "CR",
] as const;

export type RegionalProfileCountryCode =
  (typeof REGIONAL_PROFILE_COUNTRY_CODES)[number];

export type RegionalLanguage = "en" | "es";

/**
 * Kept extensible because format locales are BCP 47 values rather than a
 * closed list of countries. The defaults below document the currently known
 * values without making them UI validation rules.
 */
export type FormatLocale = string;
export type CurrencyCode = string;
export type IanaTimeZone = string;

/** Explicit profiles replace country-derived regulatory fallbacks. */
export type RegulatoryProfile =
  | "US_DEA"
  | "UK_VMD"
  | "CR_NEUTRAL";

/** `none` is the only configured provider today. Extend this union explicitly. */
export type FiscalProvider = "none";

export interface PracticeRegionalProfile {
  countryCode: RegionalProfileCountryCode;
  language: RegionalLanguage;
  formatLocale: FormatLocale;
  currencyCode: CurrencyCode;
  timezone: IanaTimeZone;
  regulatoryProfile: RegulatoryProfile;
  fiscalProvider: FiscalProvider;
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

export function isRegionalProfileCountryCode(
  value: string,
): value is RegionalProfileCountryCode {
  return REGIONAL_PROFILE_COUNTRY_CODES.includes(
    value as RegionalProfileCountryCode,
  );
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

/**
 * Compatibility helper for a later adoption task. It derives only from the
 * existing selectable-country type and does not change any active code path.
 */
export function legacyRegionalProfileDefaults(
  countryCode: ClinicRegionCode,
): PracticeRegionalProfile {
  return { ...REGIONAL_PROFILE_DEFAULTS[countryCode] };
}

/** Build an independent profile value without persisting or validating it. */
export function withRegionalProfileOverrides(
  profile: PracticeRegionalProfile,
  overrides: Partial<PracticeRegionalProfile>,
): PracticeRegionalProfile {
  return { ...profile, ...overrides };
}
