import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../messages";
import { resolvePreAuthLanguage } from "../language";
import { CLINIC_MODELS, FIRST_GOALS } from "../../onboarding/clinic-profile";

const source = (path: string) => readFileSync(path, "utf8");

describe("authentication and onboarding i18n", () => {
  it("selects Spanish explicitly from the browser and safely falls back to English", () => {
    expect(resolvePreAuthLanguage("es-CR")).toBe("es");
    expect(resolvePreAuthLanguage("en-US")).toBe("en");
    expect(resolvePreAuthLanguage("fr-FR")).toBe("en");
    expect(resolvePreAuthLanguage()).toBe("en");
  });

  it("provides complete representative ES/EN copy for every authentication flow", () => {
    expect(translate("es", "auth.login.heading")).toBe(
      "Iniciar sesión en tu clínica",
    );
    expect(translate("en", "auth.login.heading")).toBe(
      "Sign in to your practice",
    );
    expect(translate("es", "auth.forgot.heading")).toBe(
      "Restablecé tu contraseña",
    );
    expect(translate("en", "auth.reset.heading")).toBe("Choose a new password");
    expect(translate("es", "auth.invite.submit")).toBe("Activar cuenta");
    expect(translate("en", "auth.verify.heading")).toBe("Confirm your email");
  });

  it("provides ES/EN registration, onboarding and migration copy", () => {
    expect(translate("es", "auth.register.profileTitle")).toContain("clínica");
    expect(translate("en", "auth.register.profileTitle")).toContain("clinic");
    expect(translate("es", "onboarding.care.companion")).toBe(
      "Clínica de animales de compañía",
    );
    expect(translate("en", "onboarding.goal.importRecords")).toContain("PIMS");
    expect(translate("es", "onboarding.import.fileTitle")).toBe(
      "Importar desde un archivo",
    );
    expect(translate("en", "onboarding.import.fileTitle")).toBe(
      "Import from a file",
    );
    expect(translate("es", "onboarding.migration.requestBody")).toContain(
      "No enviés expedientes",
    );
  });

  it("keeps persisted onboarding values and technical CSV fields unchanged", () => {
    expect(CLINIC_MODELS).toEqual([
      "companion",
      "mobile",
      "equine",
      "specialty",
      "shelter",
      "exploring",
    ]);
    expect(FIRST_GOALS).toEqual([
      "run_visit",
      "import_records",
      "start_fresh",
      "explore_sample",
      "self_host",
    ]);
    expect(source("lib/import/sources.ts")).toContain(
      "clientId,clientEmail,patientId,name,species",
    );
    expect(source("components/onboarding/steps/bring-data.tsx")).toContain(
      'migrationProtocol: "reviewed-v1"',
    );
  });

  it("routes all target surfaces through i18n without changing branding or SMS compliance", () => {
    for (const file of [
      "app/(auth)/login/page.tsx",
      "app/(auth)/forgot-password/page.tsx",
      "app/(auth)/reset-password/page.tsx",
      "app/(auth)/accept-invite/page.tsx",
      "app/(auth)/register/page.tsx",
      "components/onboarding/journey-overlay.tsx",
      "components/onboarding/steps/bring-data.tsx",
    ]) {
      expect(source(file), file).toContain("useTranslations");
    }
    expect(source("lib/brand/platform-brand.ts")).toContain("Doctor Pet");
    expect(source("lib/messaging/consent.ts")).not.toContain("onboarding.");
  });

  it("retains the catalog fallback for unknown Spanish entries", () => {
    expect(translate("es", "auth.login.submit")).toBe("Iniciar sesión");
    expect(translate("es", "missing.phase2.key")).toBe("missing.phase2.key");
  });
});
