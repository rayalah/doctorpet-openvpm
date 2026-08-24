import { describe, expect, it } from "vitest";
import {
  legacyRegionalProfileDefaults,
  regionalProfileDefaultsForCountry,
  withRegionalProfileOverrides,
} from "../regional-profile";

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
  });
});
