import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("prescription lifecycle UI safety", () => {
  it("disables dispensing-label printing for effectively inactive prescriptions", () => {
    const source = readFileSync("app/(dashboard)/records/page.tsx", "utf8");
    expect(source).toContain(
      'disabled={rx.effectiveStatus !== "active"}',
    );
    expect(source).toContain(
      't("clinicalRecords.printLabelInactive")',
    );
  });

  it("distinguishes external authorization, clinic stock, and billing scope", () => {
    const source = readFileSync(
      "components/records/prescription-lifecycle-control.tsx",
      "utf8",
    );
    expect(source).toContain('t("clinicalRecords.prescription.refillExternalTitle")');
    expect(source).toContain('t("clinicalRecords.prescription.refillExternalHelp")');
    expect(source).toContain('t("clinicalRecords.prescription.refillStockHelp")');
    expect(source).toContain('t("clinicalRecords.prescription.refillStockSuccess")');
    expect(source).toContain('t("clinicalRecords.prescription.billing")');
  });

  it("uses the practice language for lifecycle dates and UI copy", () => {
    const source = readFileSync(
      "components/records/prescription-lifecycle-control.tsx",
      "utf8",
    );
    expect(source).toContain("dateLocaleForLanguage(useLanguage())");
    expect(source).toContain("formatEventTime(event.createdAt, timeZone, dateLocale)");
    expect(source).toContain('t("clinicalRecords.prescription.controlledDrugNotice")');
    expect(source).toContain('t("clinicalRecords.prescription.invalidInventoryQuantity")');
  });

  it("gates only the foreign controlled-drug notice", () => {
    const controlSource = readFileSync(
      "components/records/prescription-lifecycle-control.tsx",
      "utf8",
    );
    const recordsSource = readFileSync(
      "app/(dashboard)/records/page.tsx",
      "utf8",
    );

    expect(controlSource).toContain("showControlledDrugComplianceNotice");
    expect(recordsSource).toContain(
      "regulatoryAccess?.supportsControlledDrugCompliance === true",
    );
    expect(recordsSource).toContain("createPrescription");
  });

  it("resets the idempotency key when lifecycle intent changes", () => {
    const source = readFileSync(
      "components/records/prescription-lifecycle-control.tsx",
      "utf8",
    );
    const reasonChange = source.match(
      /onChange=\{\(event\) => \{[\s\S]+?operationId\.current = null;[\s\S]+?\}\}/,
    );
    expect(reasonChange).not.toBeNull();
  });

  it("uses effective status in patient medical-summary exports", () => {
    const source = readFileSync(
      "app/(dashboard)/patients/[id]/page.tsx",
      "utf8",
    );
    expect(source).toContain('status: rx.effectiveStatus ?? "active"');
    expect(source).not.toContain('status: rx.status ?? "active"');
  });
});
