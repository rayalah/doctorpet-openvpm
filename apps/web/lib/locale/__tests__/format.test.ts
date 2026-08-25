import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  regulatoryFramework,
  regionDefaults,
  localeForCountry,
} from "../format";

describe("formatCurrency", () => {
  it("formats USD with a dollar sign", () => {
    const s = formatCurrency(65, "usd");
    expect(s).toContain("$");
    expect(s).toContain("65");
  });
  it("formats GBP with a pound sign in en-GB", () => {
    const s = formatCurrency(65, "gbp", "GB");
    expect(s).toContain("£");
    expect(s).toContain("65");
  });
  it("formats EUR", () => {
    expect(formatCurrency(40, "eur", "IE")).toContain("€");
  });
  it("uses native es-CR formatting for CRC", () => {
    const expected = new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
    }).format(1234.5);

    expect(formatCurrency(1234.5, "crc", "CR")).toBe(expected);
  });
  it("accepts string amounts from the DB and coerces them", () => {
    const s = formatCurrency("65.00", "gbp", "GB");
    expect(s).toContain("£");
    expect(s).toContain("65");
  });
  it("treats null/undefined/non-numeric as zero", () => {
    expect(formatCurrency(null)).toContain("0");
    expect(formatCurrency(undefined)).toContain("0");
    expect(formatCurrency("not-a-number")).toContain("0");
  });
});

describe("formatDate", () => {
  it("uses month/day order for the US and day/month for the UK", () => {
    const us = formatDate("2026-06-07", "US");
    const gb = formatDate("2026-06-07", "GB");
    expect(us).toBe("06/07/2026");
    expect(gb).toBe("07/06/2026");
  });
});

describe("regulatoryFramework", () => {
  it("returns uk_vmd for GB, us_dea otherwise", () => {
    expect(regulatoryFramework("GB")).toBe("uk_vmd");
    expect(regulatoryFramework("US")).toBe("us_dea");
    expect(regulatoryFramework(null)).toBe("us_dea");
  });
});

describe("regionDefaults", () => {
  it("keeps legacy tax defaults and requires an explicit Costa Rica rate", () => {
    expect(regionDefaults("US")).toMatchObject({ currency: "usd", taxRatePercent: "8.00" });
    expect(regionDefaults("ZZ")).toMatchObject({ currency: "usd" });
    expect(regionDefaults("GB")).toMatchObject({
      currency: "gbp",
      taxRatePercent: "20.00",
      timezone: "Europe/London",
    });
    expect(regionDefaults("CR")).toEqual({
      currency: "crc",
      taxRatePercent: null,
      timezone: "America/Costa_Rica",
    });
  });
});

describe("localeForCountry", () => {
  it("maps known countries and falls back to en-US", () => {
    expect(localeForCountry("GB")).toBe("en-GB");
    expect(localeForCountry("CR")).toBe("es-CR");
    expect(localeForCountry("xx")).toBe("en-US");
    expect(localeForCountry(null)).toBe("en-US");
  });
});
