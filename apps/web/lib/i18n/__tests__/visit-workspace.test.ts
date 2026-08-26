import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTranslator } from "../messages";
import {
  enVisitWorkspaceMessages,
  esVisitWorkspaceMessages,
} from "../messages/visit-workspace";

const workspaceSource = readFileSync(
  "app/(dashboard)/encounters/[appointmentId]/page.tsx",
  "utf8",
);

describe("visit workspace i18n", () => {
  it("keeps the Spanish visit catalog complete against English", () => {
    for (const key of Object.keys(enVisitWorkspaceMessages)) {
      expect(esVisitWorkspaceMessages).toHaveProperty(key);
    }
  });

  it("translates representative workspace surfaces without changing enum values", () => {
    const en = createTranslator("en");
    const es = createTranslator("es");

    expect(en("visit.clinicalWork")).toBe("Clinical work");
    expect(es("visit.clinicalWork")).toBe("Trabajo clínico");
    expect(es("visit.invoiceState")).toBe("Estado de la factura");
    expect(es("visit.vitalsClosed")).toContain("cerrada");
    expect(es("visit.followUpScheduled")).toBe("Seguimiento programado");
    expect(es("visit.completeVisit")).toBe("Completar consulta");
    expect(es("appointments.status.checked_out")).toBe("Atendida");
    expect(en("appointments.status.checked_out")).toBe("Checked Out");
    expect(es("visit.unitPriceFor")).toBe("Precio unitario para");
  });

  it("routes user-facing workspace copy through translations", () => {
    expect(workspaceSource).toContain('useTranslations()');
    for (const literal of [
      "Clinical handoff finalized",
      "Visit completed safely",
      "Loading existing visit charges...",
      "Checking whether this visit accepts new vitals...",
      "Add visit charge",
    ]) {
      expect(workspaceSource).not.toContain(literal);
    }
  });
});
