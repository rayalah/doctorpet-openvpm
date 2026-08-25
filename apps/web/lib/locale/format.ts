/**
 * Region/locale helpers. Pure — gates currency + date formatting and supplies
 * sensible regional defaults so the app isn't hardcoded to US/USD/8% tax.
 * `country` is ISO 3166-1 alpha-2 (e.g. "US", "GB"); `currency` ISO 4217.
 */

import type { RegulatoryProfile } from "./regional-profile";

const COUNTRY_LOCALE: Record<string, string> = {
  US: "en-US",
  GB: "en-GB",
  IE: "en-IE",
  CA: "en-CA",
  AU: "en-AU",
  CR: "es-CR",
};

export function localeForCountry(country?: string | null): string {
  return COUNTRY_LOCALE[(country ?? "US").toUpperCase()] ?? "en-US";
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = "usd",
  country?: string | null
): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat(localeForCountry(country), {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Number.isFinite(n) ? (n as number) : 0);
}

export function formatDate(date: Date | string, country?: string | null): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeForCountry(country), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    // Date-only values must not shift by the runtime's timezone.
    timeZone: "UTC",
  }).format(d);
}

/**
 * Maps only an explicit persisted profile to its foreign framework.
 * Neutral or missing profiles never fall back to DEA.
 */
export function regulatoryFramework(
  profile?: RegulatoryProfile | null,
): "uk_vmd" | "us_dea" | null {
  if (profile === "UK_VMD") return "uk_vmd";
  if (profile === "US_DEA") return "us_dea";
  return null;
}

export interface RegionDefaults {
  currency: string;
  /**
   * Standard sales-tax / VAT rate where the product already has an explicit
   * legacy default. Null means the administrator must provide it deliberately.
   */
  taxRatePercent: string | null;
  timezone: string;
}

/** Defaults applied when a practice picks a country (onboarding / settings). */
export function regionDefaults(country?: string | null): RegionDefaults {
  switch ((country ?? "US").toUpperCase()) {
    case "GB":
      return { currency: "gbp", taxRatePercent: "20.00", timezone: "Europe/London" };
    case "IE":
      return { currency: "eur", taxRatePercent: "23.00", timezone: "Europe/Dublin" };
    case "CA":
      return { currency: "cad", taxRatePercent: "5.00", timezone: "America/Toronto" };
    case "AU":
      return { currency: "aud", taxRatePercent: "10.00", timezone: "Australia/Sydney" };
    case "CR":
      // Costa Rica is selectable, but this project makes no tax-rate or
      // fiscal-compliance assertion. The UI/API require an explicit value.
      return { currency: "crc", taxRatePercent: null, timezone: "America/Costa_Rica" };
    default:
      return { currency: "usd", taxRatePercent: "8.00", timezone: "America/New_York" };
  }
}
