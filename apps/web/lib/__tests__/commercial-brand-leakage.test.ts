import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const commercialSurfaces = [
  "../../app/(auth)/login/page.tsx",
  "../../app/(auth)/register/page.tsx",
  "../../app/(dashboard)/agent/page.tsx",
  "../../app/(dashboard)/settings/page.tsx",
  "../../app/email-preferences/page.tsx",
  "../../app/email-preferences/preference-form.tsx",
  "../../app/capture/layout.tsx",
  "../../app/clinic-fit/page.tsx",
  "../../app/sign/layout.tsx",
  "../../app/sms/[practiceId]/layout.tsx",
  "../../app/sms/[practiceId]/page.tsx",
  "../../app/sms/[practiceId]/opt-in/page.tsx",
  "../../app/sms/[practiceId]/privacy/page.tsx",
  "../../app/sms/[practiceId]/terms/page.tsx",
  "../../app/api-docs/page.tsx",
  "../../components/welcome/welcome-copy.ts",
  "../../components/welcome/welcome-surface.tsx",
  "../../components/settings/messaging-tab.tsx",
  "../../components/settings/messaging-wizard.tsx",
  "../../components/settings/messaging-registration-form.tsx",
  "../../components/tour/tour-steps.ts",
];

// Legal/open-source pages, compatibility modules, internal identifiers, and
// upstream links are intentionally excluded: they are not commercial copy.
const explicitAllowlist = [
  "../../app/legal/open-source/page.tsx",
  "../../app/legal/terms/page.tsx",
  "../../app/legal/privacy/page.tsx",
  "../../lib/compat/openvpm/schema.ts",
];

const prohibitedCommercialCopy = [
  "Powered by OpenVPM",
  "Welcome to OpenVPM",
  "OpenVPM Agent",
  "OpenVPM Cloud",
  "OpenVPM support",
  "Emails from OpenVPM",
];

describe("Doctor Pet commercial branding", () => {
  it("keeps the scope explicit so legal and technical OpenVPM references are not scanned as commercial copy", () => {
    expect(explicitAllowlist).toEqual([
      "../../app/legal/open-source/page.tsx",
      "../../app/legal/terms/page.tsx",
      "../../app/legal/privacy/page.tsx",
      "../../lib/compat/openvpm/schema.ts",
    ]);
  });

  it.each(commercialSurfaces)("does not leak OpenVPM commercial copy in %s", (path) => {
    const source = readFileSync(
      fileURLToPath(new URL(path, import.meta.url)),
      "utf8",
    );

    for (const phrase of prohibitedCommercialCopy) {
      expect(source).not.toContain(phrase);
    }
  });
});
