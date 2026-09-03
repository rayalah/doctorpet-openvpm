import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLATFORM_FALLBACK_LANGUAGE,
  resolveAuthenticatedPracticeLanguage,
  resolveLanguage,
  resolvePreAuthLanguage,
  resolvePublicTenantLanguage,
} from "../language";
import { createTranslator, enMessages, translate } from "../messages";
import { getTranslations } from "../server";

describe("i18n foundation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
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

  it("keeps common.edit complete in English and Spanish", () => {
    expect(translate("en", "common.edit")).toBe("Edit");
    expect(translate("es", "common.edit")).toBe("Editar");
  });

  it("warns once outside production when a canonical Spanish translation is missing", () => {
    vi.stubEnv("NODE_ENV", "test");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const catalog = enMessages as Record<string, string>;
    catalog["test.missingSpanish"] = "Missing Spanish";

    try {
      expect(translate("es", "test.missingSpanish")).toBe("Missing Spanish");
      expect(translate("es", "test.missingSpanish")).toBe("Missing Spanish");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[i18n] Missing Spanish translation for "test.missingSpanish"; falling back to English.',
      );
    } finally {
      delete catalog["test.missingSpanish"];
    }
  });

  it("keeps the missing-Spanish signal silent in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const catalog = enMessages as Record<string, string>;
    catalog["test.productionMissingSpanish"] = "Production fallback";

    try {
      expect(translate("es", "test.productionMissingSpanish")).toBe(
        "Production fallback",
      );
      expect(warn).not.toHaveBeenCalled();
    } finally {
      delete catalog["test.productionMissingSpanish"];
    }
  });

  it("exposes unknown keys safely without reporting them as missing catalog entries", () => {
    expect(translate("es", "missing.translation.key")).toBe(
      "missing.translation.key",
    );
  });
});
