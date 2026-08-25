import {
  CLINIC_REGION_CODES,
  type ClinicRegionCode,
} from "./clinic-regions";
import {
  regionalCatalogEntryForCountry,
  type RegionalCatalogEntry,
} from "./regional-profile";

function activeCatalogEntry(countryCode: ClinicRegionCode): RegionalCatalogEntry {
  const entry = regionalCatalogEntryForCountry(countryCode);
  if (!entry) {
    throw new Error(`Missing regional catalog entry for ${countryCode}`);
  }
  return entry;
}

/** UI options derive from the regional catalog for active practice countries. */
const ACTIVE_REGIONAL_CATALOG = CLINIC_REGION_CODES.map(activeCatalogEntry);

// Keep every existing UI choice while catalog profiles contribute their
// regional defaults (including America/Costa_Rica).
const LEGACY_PRACTICE_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export const PRACTICE_TIMEZONES = [
  ...new Set([
    ...LEGACY_PRACTICE_TIMEZONES,
    ...ACTIVE_REGIONAL_CATALOG.map((entry) => entry.timezone),
  ]),
] as string[];

export const PRACTICE_CURRENCY_OPTIONS = [
  ...new Map(
    ACTIVE_REGIONAL_CATALOG.map((entry) => [
      entry.currencyCode,
      {
        code: entry.currencyCode,
        label: `${entry.currency.code} — ${entry.currency.name}`,
      },
    ]),
  ).values(),
];
