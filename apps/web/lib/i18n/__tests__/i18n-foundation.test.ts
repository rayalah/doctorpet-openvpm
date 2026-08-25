import { describe, expect, it } from "vitest";
import {
  PLATFORM_FALLBACK_LANGUAGE,
  resolveAuthenticatedPracticeLanguage,
  resolveLanguage,
  resolvePreAuthLanguage,
  resolvePublicTenantLanguage,
} from "../language";
import { createTranslator, translate } from "../messages";
import { getTranslations } from "../server";

describe("i18n foundation", () => {
  it("uses English as the typed platform fallback", () => {
    expect(PLATFORM_FALLBACK_LANGUAGE).toBe("en");
    expect(resolveLanguage(undefined)).toBe("en");
    expect(resolveLanguage("fr")).toBe("en");
  });

  it("uses an authenticated practice's persisted language only", () => {
    expect(resolveAuthenticatedPracticeLanguage({ language: "es" })).toBe("es");
    expect(resolveAuthenticatedPracticeLanguage({ language: "en" })).toBe("en");
    expect(resolveAuthenticatedPracticeLanguage({ language: "fr" })).toBe("en");
  });

  it("uses a public tenant's persisted language only", () => {
    expect(resolvePublicTenantLanguage({ language: "es" })).toBe("es");
    expect(resolvePublicTenantLanguage(null)).toBe("en");
  });

  it("keeps pre-auth routes on the explicit platform fallback", () => {
    expect(resolvePreAuthLanguage()).toBe("en");
  });

  it("does not derive UI language from formatting locale or another regional field", () => {
    const regionalData = {
      language: "en",
      formatLocale: "es-CR",
      country: "CR",
      currency: "crc",
      timezone: "America/Costa_Rica",
    };

    expect(resolveAuthenticatedPracticeLanguage(regionalData)).toBe("en");
    expect(resolvePublicTenantLanguage(regionalData)).toBe("en");
  });

  it("returns Spanish login copy through the server translation entry point", () => {
    const t = getTranslations("es");

    expect(t("auth.login.heading")).toBe("Iniciar sesión en tu clínica");
    expect(t("auth.login.email")).toBe("Correo electrónico");
    expect(t("auth.login.password")).toBe("Contraseña");
    expect(t("auth.login.forgotPassword")).toBe("¿Olvidaste tu contraseña?");
    expect(t("auth.login.registerPractice")).toBe("Registrar tu clínica");
  });

  it("preserves English login copy", () => {
    const t = createTranslator("en");

    expect(t("auth.login.heading")).toBe("Sign in to your practice");
    expect(t("auth.login.submit")).toBe("Sign in");
  });

  it("falls back to English for a missing localized key and exposes unknown keys safely", () => {
    expect(translate("es", "common.edit")).toBe("Edit");
    expect(translate("es", "missing.translation.key")).toBe(
      "missing.translation.key",
    );
  });
});
