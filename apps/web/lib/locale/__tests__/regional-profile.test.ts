import { describe, expect, it } from "vitest";
import {
  legacyRegionalProfileDefaults,
  practiceRegionalProfileFromPersisted,
  regionalCatalogEntryForCountry,
  regionalProfileDefaultsForCountry,
  withRegionalProfileOverrides,
} from "../regional-profile";
import { isSupportedPracticeTimezone } from "../../settings-policy";

describe("regional profile foundation", () => {
  it("represents every legacy selectable country without changing its defaults", () => {
    expect(legacyRegionalProfileDefaults("US")).toMatchObject({
      language: "en",
      formatLocale: "en-US",
      currencyCode: "usd",
      timezone: "America/New_York",
      regulatoryProfile: "US_DEA",
      fiscalProvider: "none",
    });
    expect(legacyRegionalProfileDefaults("GB")).toMatchObject({
      language: "en",
      formatLocale: "en-GB",
      currencyCode: "gbp",
      timezone: "Europe/London",
      regulatoryProfile: "UK_VMD",
      fiscalProvider: "none",
    });
    expect(legacyRegionalProfileDefaults("CA").regulatoryProfile).toBe("US_DEA");
    expect(legacyRegionalProfileDefaults("IE").regulatoryProfile).toBe("US_DEA");
    expect(legacyRegionalProfileDefaults("AU").regulatoryProfile).toBe("US_DEA");
  });

  it("represents the conceptual Costa Rica profile without making it active", () => {
    expect(regionalProfileDefaultsForCountry("CR")).toEqual({
      countryCode: "CR",
      language: "es",
      formatLocale: "es-CR",
      currencyCode: "crc",
      timezone: "America/Costa_Rica",
      regulatoryProfile: "CR_NEUTRAL",
      fiscalProvider: "none",
    });
  });

  it("provides Costa Rica catalog metadata without adding it to active UI options", () => {
    const entry = regionalCatalogEntryForCountry("CR");

    expect(entry).toMatchObject({
      countryCode: "CR",
      countryName: "Costa Rica",
      currency: {
        code: "CRC",
        name: "Colón costarricense",
        symbol: "₡",
      },
      phoneCountryCode: "+506",
    });
    expect(entry?.currencyCode.toUpperCase()).toBe("CRC");
  });

  it("recognizes the Costa Rica timezone as a valid IANA timezone", () => {
    expect(isSupportedPracticeTimezone("America/Costa_Rica")).toBe(true);
  });

  it("keeps regional dimensions independent when one value changes", () => {
    const base = regionalProfileDefaultsForCountry("US")!;

    expect(withRegionalProfileOverrides(base, { language: "es" })).toMatchObject({
      countryCode: "US",
      language: "es",
      currencyCode: "usd",
    });
    expect(withRegionalProfileOverrides(base, { currencyCode: "crc" })).toMatchObject({
      countryCode: "US",
      language: "en",
      currencyCode: "crc",
    });
    expect(
      withRegionalProfileOverrides(base, { regulatoryProfile: "CR_NEUTRAL" }),
    ).toMatchObject({
      countryCode: "US",
      regulatoryProfile: "CR_NEUTRAL",
    });
  });

  it("does not infer US DEA for an unknown country", () => {
    expect(regionalProfileDefaultsForCountry("ZZ")).toBeNull();
    expect(regionalProfileDefaultsForCountry(null)).toBeNull();
    expect(
      practiceRegionalProfileFromPersisted({
        country: "ZZ",
        currency: "usd",
        timezone: "America/New_York",
        language: "en",
        formatLocale: "en-US",
        regulatoryProfile: "US_DEA",
        fiscalProvider: "none",
      }),
    ).toBeNull();
  });

  it("reconstructs legacy-compatible persisted fields without re-deriving them", () => {
    expect(
      practiceRegionalProfileFromPersisted({
        country: "IE",
        currency: "eur",
        timezone: "Europe/Dublin",
        language: "en",
        formatLocale: "en-IE",
        regulatoryProfile: "US_DEA",
        fiscalProvider: "none",
      }),
    ).toEqual(legacyRegionalProfileDefaults("IE"));
  });

  it("reconstructs a conceptual Costa Rica profile from storage only", () => {
    expect(
      practiceRegionalProfileFromPersisted({
        country: "CR",
        currency: "crc",
        timezone: "America/Costa_Rica",
        language: "es",
        formatLocale: "es-CR",
        regulatoryProfile: "CR_NEUTRAL",
        fiscalProvider: "none",
      }),
    ).toEqual(regionalProfileDefaultsForCountry("CR"));
  });

  it("keeps persisted language, currency, and regulatory choices independent", () => {
    const base = {
      country: "US",
      currency: "usd",
      timezone: "America/New_York",
      language: "en",
      formatLocale: "en-US",
      regulatoryProfile: "US_DEA",
      fiscalProvider: "none",
    } as const;

    expect(
      practiceRegionalProfileFromPersisted({ ...base, language: "es" }),
    ).toMatchObject({ countryCode: "US", language: "es" });
    expect(
      practiceRegionalProfileFromPersisted({ ...base, currency: "crc" }),
    ).toMatchObject({ countryCode: "US", currencyCode: "crc" });
    expect(
      practiceRegionalProfileFromPersisted({
        ...base,
        regulatoryProfile: "CR_NEUTRAL",
      }),
    ).toMatchObject({ countryCode: "US", regulatoryProfile: "CR_NEUTRAL" });
  });

  it("rejects invalid persisted dimensions and only accepts the none provider", () => {
    const base = {
      country: "US",
      currency: "usd",
      timezone: "America/New_York",
      language: "en",
      formatLocale: "en-US",
      regulatoryProfile: "US_DEA",
      fiscalProvider: "none",
    } as const;

    expect(
      practiceRegionalProfileFromPersisted({ ...base, language: "fr" }),
    ).toBeNull();
    expect(
      practiceRegionalProfileFromPersisted({ ...base, fiscalProvider: "gtI" }),
    ).toBeNull();
    expect(practiceRegionalProfileFromPersisted(base)?.fiscalProvider).toBe(
      "none",
    );
  });
});
