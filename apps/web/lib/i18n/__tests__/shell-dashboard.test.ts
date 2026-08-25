import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveAuthenticatedPracticeLanguage } from "../language";
import { getTranslations } from "../server";

describe("authenticated shell and dashboard localization", () => {
  it("provides Spanish sidebar and top-bar labels", () => {
    const t = getTranslations("es");

    expect(t("navigation.dashboard")).toBe("Panel principal");
    expect(t("navigation.clients")).toBe("Tutores");
    expect(t("navigation.patients")).toBe("Pacientes");
    expect(t("navigation.schedule")).toBe("Citas");
    expect(t("navigation.settings")).toBe("Configuración");
    expect(t("navigation.newAppointment")).toBe("Nueva cita");
  });

  it("preserves the English shell and dashboard catalog", () => {
    const t = getTranslations("en");

    expect(t("navigation.dashboard")).toBe("Dashboard");
    expect(t("navigation.clients")).toBe("Clients");
    expect(t("dashboard.kpi.todayAppointments")).toBe(
      "Today's Appointments",
    );
    expect(t("dashboard.charts.revenue")).toBe("Revenue");
  });

  it("provides Spanish dashboard and welcome copy", () => {
    const t = getTranslations("es");

    expect(t("dashboard.kpi.todayAppointments")).toBe("Citas de hoy");
    expect(t("dashboard.upcoming.emptyAction")).toBe(
      "Reservar la primera cita",
    );
    expect(t("welcome.skip")).toBe("Omitir por ahora");
    expect(t("welcome.card.portal.caption")).toBe(
      "Ofrecé a tus tutores su propio portal",
    );
  });

  it("uses only the authenticated practice language and falls back safely", () => {
    expect(resolveAuthenticatedPracticeLanguage({ language: "es" })).toBe("es");
    expect(resolveAuthenticatedPracticeLanguage({ language: "en" })).toBe("en");
    expect(resolveAuthenticatedPracticeLanguage({ language: "fr" })).toBe("en");
  });

  it("connects the authenticated shell to the protected practice source", () => {
    const provider = readFileSync(
      "components/layout/authenticated-i18n-provider.tsx",
      "utf8",
    );
    const layout = readFileSync("app/(dashboard)/layout.tsx", "utf8");
    const sidebar = readFileSync("components/layout/sidebar.tsx", "utf8");
    const dashboard = readFileSync("app/(dashboard)/page.tsx", "utf8");

    expect(provider).toContain("trpc.settings.getPractice.useQuery");
    expect(provider).toContain(
      "resolveAuthenticatedPracticeLanguage(practice.data)",
    );
    expect(layout).toContain("<AuthenticatedI18nProvider>");
    expect(sidebar).toContain("const t = useTranslations()");
    expect(dashboard).toContain("const t = useTranslations()");
  });
});
