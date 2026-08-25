import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registerPage = readFileSync(
  new URL("../../app/(auth)/register/page.tsx", import.meta.url),
  "utf8",
);
const settingsPage = readFileSync(
  new URL("../../app/(dashboard)/settings/page.tsx", import.meta.url),
  "utf8",
);
const onboardingStep = readFileSync(
  new URL("../../components/onboarding/steps/practice-basics.tsx", import.meta.url),
  "utf8",
);
const settingsRouter = readFileSync(
  new URL("../../server/routers/settings.ts", import.meta.url),
  "utf8",
);

describe("Costa Rica practice activation UI", () => {
  it("uses the active country list in registration, settings, and onboarding", () => {
    expect(registerPage).toContain("CLINIC_REGION_OPTIONS.map");
    expect(settingsPage).toContain("CLINIC_REGION_OPTIONS.map");
    expect(onboardingStep).toContain("CLINIC_REGION_OPTIONS.map");
  });

  it("exposes catalog-backed CRC and America/Costa_Rica options", () => {
    expect(settingsPage).toContain("PRACTICE_CURRENCY_OPTIONS");
    expect(settingsPage).toContain("PRACTICE_TIMEZONES");
    expect(onboardingStep).toContain("PRACTICE_TIMEZONES");
  });

  it("requires an explicit CR tax rate and blocks country reinterpretation after invoices", () => {
    expect(registerPage).toContain('country === "CR"');
    expect(onboardingStep).toContain('country === "CR"');
    expect(settingsRouter).toContain("No Costa Rica tax default is configured.");
    expect(settingsRouter).toContain("Cannot change a practice with invoices to Costa Rica");
  });
});
