import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "../messages";
import { I18nProvider } from "../client";
import { PageLoading } from "@/components/common/loading";

const webRoot = resolve(__dirname, "../../..");

function source(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), "utf8");
}

describe("shared UI localization", () => {
  it("renders shared UI through the active provider language", () => {
    vi.stubGlobal("React", React);
    const spanish = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        { language: "es" },
        React.createElement(PageLoading),
      ),
    );
    const english = renderToStaticMarkup(
      React.createElement(
        I18nProvider,
        { language: "en" },
        React.createElement(PageLoading),
      ),
    );

    expect(spanish).toContain("Cargando...");
    expect(english).toContain("Loading...");
  });

  it("renders representative Lot 1 copy in Spanish and English", () => {
    const en = createTranslator("en");
    const es = createTranslator("es");

    expect(en("whiteboard.column.waiting")).toBe("Waiting");
    expect(es("whiteboard.column.waiting")).toBe("En espera");
    expect(en("search.quickActions")).toBe("Quick Actions");
    expect(es("search.quickActions")).toBe("Acciones rápidas");
    expect(en("activation.tour.label")).toBe("Take the 60-second tour");
    expect(es("activation.tour.label")).toBe("Realizá el recorrido de 60 segundos");
    expect(en("trial.endsToday")).toBe("Trial ends today");
    expect(es("trial.endsToday")).toBe("La prueba termina hoy");
    expect(es("recovery.title")).toBe(
      "El modo de revisión de datos protegidos está activo",
    );
  });

  it("connects each shared surface to the translator", () => {
    for (const file of [
      "app/(dashboard)/whiteboard/page.tsx",
      "components/common/command-search.tsx",
      "components/dashboard/activation-checklist.tsx",
      "components/common/error-boundary.tsx",
      "components/common/loading.tsx",
      "components/layout/trial-badge.tsx",
      "components/layout/verify-email-banner.tsx",
      "components/layout/recovery-review-banner.tsx",
    ]) {
      expect(source(file), file).toContain("useTranslations");
    }
  });

  it("keeps canonical appointment status values unchanged while translating labels", () => {
    const whiteboard = source("app/(dashboard)/whiteboard/page.tsx");
    for (const status of [
      "scheduled",
      "confirmed",
      "checked_in",
      "in_exam",
      "checked_out",
      "no_show",
      "cancelled",
    ]) {
      expect(whiteboard).toContain(`\"${status}\"`);
    }
    expect(whiteboard).toContain("STATUS_LABEL_KEYS");
    expect(whiteboard).toContain("appointments.status.checked_in");
  });
});
