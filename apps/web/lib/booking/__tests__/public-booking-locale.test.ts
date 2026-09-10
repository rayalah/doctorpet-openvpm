import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/book/[slug]/page.tsx", "utf8");
const provider = readFileSync("lib/i18n/public-booking-provider.tsx", "utf8");

describe("public booking locale", () => {
  it("wraps public booking in its tenant locale provider", () => {
    expect(page).toContain("<PublicBookingI18nProvider slug={slug}>");
    expect(provider).toContain("resolvePublicTenantLanguage");
    expect(provider).toContain("DOCTOR_PET_INITIAL_LANGUAGE");
  });

  it("uses no visitor locale, cookie, or request header to select tenant copy", () => {
    const source = `${page}\n${provider}`;
    expect(source).not.toContain("navigator.language");
    expect(source).not.toContain("Accept-Language");
    expect(source).not.toContain("cookies(");
  });
});
