import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateInvoicePdf, generateMedicalSummaryPdf, generateReportPdf } from "../pdf";

describe("medical summary header", () => {
  const source = readFileSync("lib/pdf.ts", "utf8");

  it("stacks logo, clinic name, then the title so long names cannot collide", () => {
    const headerSection = source.slice(
      source.indexOf("export function generateMedicalSummaryPdf"),
      source.indexOf('sectionHeading(t("documents.patientInformation"))')
    );
    const logoAt = headerSection.indexOf("drawPawMark");
    const nameAt = headerSection.indexOf("splitTextToSize(data.practiceName");
    const titleAt = headerSection.indexOf('t("documents.medicalRecordSummary")');
    expect(logoAt).toBeGreaterThan(-1);
    expect(nameAt).toBeGreaterThan(logoAt);
    expect(titleAt).toBeGreaterThan(nameAt);
    // The title is no longer right-aligned onto the same line as the name.
    expect(headerSection).not.toContain('align: "right"');
  });

  it("renders with a very long clinic name without throwing", () => {
    const doc = generateMedicalSummaryPdf({
      practiceName:
        "Bushwick Veterinary Clinic and Animal Wellness Center of Greater Brooklyn",
      practiceAddress: "123 Knickerbocker Ave, Brooklyn, NY",
      practicePhone: "(555) 000-1234",
      patientName: "Biscuit",
      species: "Canine",
      clientName: "Jordan Avery",
      allergies: [],
      problems: [],
      vaccinations: [{ name: "Rabies", date: "2026-05-01", nextDue: "2027-05-01" }],
      recentNotes: [],
      prescriptions: [],
      generatedDate: "7/11/2026",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });

  it("paginates long SOAP sections and addenda while retaining correction evidence", () => {
    const longClinicalText = Array.from(
      { length: 900 },
      (_, index) => `observation-${index}`,
    ).join(" ");
    const doc = generateMedicalSummaryPdf({
      practiceName: "OpenVPM Test Clinic",
      patientName: "Biscuit",
      species: "Canine",
      clientName: "Jordan Avery",
      allergies: [],
      problems: [],
      vaccinations: [],
      recentNotes: [
        {
          date: "August 9, 2026",
          subjective: longClinicalText,
          authorName: "Dr. Rivera",
          finalizerName: "Dr. Rivera",
          finalizedAt: "August 9, 2026 at 10:30 AM",
          addenda: [
            {
              content: longClinicalText,
              authorName: "Dr. Rivera",
              createdAt: "August 9, 2026 at 11:00 AM",
            },
          ],
        },
      ],
      recordCorrections: [
        {
          recordLabel: "SOAP note dated August 8, 2026",
          reason: "Documented on the wrong visit.",
          correctedByName: "Dr. Rivera",
          correctedAt: "August 9, 2026 at 11:30 AM",
        },
      ],
      prescriptions: [],
      generatedDate: "8/9/2026",
    });

    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(10_000);
  });
});

describe("pdf generation date labels", () => {
  const source = readFileSync("lib/pdf.ts", "utf8");

  it("uses caller-provided generated dates for medical summaries", () => {
    expect(source).toContain("generatedDate?: string;");
    expect(source).toContain("function formatGeneratedDateUtc(language: SupportedLanguage = \"en\")");
    expect(source).toContain(
      'language === "es" ? "es-CR" : "en-US"'
    );
    expect(source).toContain(
      "const generatedDate = data.generatedDate ?? formatGeneratedDateUtc()"
    );
    expect(source).toContain('t("documents.generatedOn")');
    expect(source).not.toContain("const today = new Date().toLocaleDateString()");
  });

  it("generates vaccination certificates with caller-provided date labels", () => {
    expect(source).toContain("export interface VaccinationCertificateData");
    expect(source).toContain("export function generateVaccinationCertificatePdf");
    expect(source).toContain("VACCINATION CERTIFICATE");
    expect(source).toContain("[\"Vaccine\", data.vaccineName]");
    expect(source).toContain("[\"Administered\", data.administeredAt]");
    expect(source).toContain("[\"Next due\", data.nextDueDate]");
    expect(source).toContain("[\"Manufacturer\", data.manufacturer]");
    expect(source).toContain("[\"Lot number\", data.lotNumber]");
    expect(source).toContain(
      "const generatedDate = data.generatedDate ?? formatGeneratedDateUtc(language)"
    );
  });

  it("generates generic tabular report PDFs", () => {
    expect(source).toContain("export interface ReportPdfData");
    expect(source).toContain("export function generateReportPdf");
    expect(source).toContain(
      'orientation: data.columns.length > 4 ? "landscape" : "portrait"'
    );
    expect(source).toContain("data.columns.forEach((column, index) =>");
    expect(source).toContain(
      'doc.text(data.emptyMessage ?? t("pdf.noData"), margin, y)'
    );
    expect(source).toContain('t("documents.pageOf")');
  });
});

describe("PDF branding compatibility", () => {
  const source = readFileSync("lib/pdf.ts", "utf8");

  it("keeps tenant branding optional and adds a discrete platform footer", () => {
    expect(source).toContain("export type PdfBranding");
    expect(source).toContain("tenantLogoDataUrl?: string;");
    expect(source).toContain('"branding.documentPlatform"');
  });
});

describe("localized financial and report PDFs", () => {
  it("localizes invoice labels and status while preserving the CRC amount input", () => {
    const doc = generateInvoicePdf({
      language: "es",
      practiceName: "Agroveterinaria Dr. Cubillo",
      clientName: "Jordan Avery",
      patientName: "Biscuit",
      invoiceDate: "31/12/2026",
      status: "paid",
      items: [{ description: "Consulta", quantity: 1, unitPrice: "₡3 000,00", total: "₡3 000,00" }],
      subtotal: "₡3 000,00",
      tax: "₡0,00",
      total: "₡3 000,00",
      paidAmount: "₡3 000,00",
      balanceDue: "₡0,00",
    });
    const output = doc.output();
    expect(output).toContain("FACTURA");
    expect(output).toContain("PAGADA");
    expect(output).toContain("Descripción");
    expect(output).not.toContain("¡3 000");
  });

  it("localizes tabular report PDFs and preserves English fallback", () => {
    const es = generateReportPdf({
      language: "es",
      title: "Reporte de ingresos",
      columns: ["Sección", "Total"],
      rows: [["Total del período", "₡3 000,00"]],
      generatedDate: "31/12/2026",
    }).output();
    const en = generateReportPdf({
      language: "en",
      title: "Revenue Report",
      columns: ["Section", "Total"],
      rows: [["Selected period", "$100.00"]],
      generatedDate: "12/31/2026",
    }).output();
    expect(es).toContain("Generado el");
    expect(es).not.toContain("¡3 000");
    expect(en).toContain("Generated on");
  });

  it("localizes medical summary structure without translating clinical content", () => {
    const output = generateMedicalSummaryPdf({
      language: "es",
      practiceName: "Agroveterinaria Dr. Cubillo",
      patientName: "Biscuit",
      species: "Canine",
      clientName: "Jordan Avery",
      allergies: [],
      problems: [],
      vaccinations: [],
      recentNotes: [
        {
          date: "31 dic 2026",
          subjective: "Owner reports improved appetite.",
          authorName: "Dr. Rivera",
          finalizerName: "Dr. Rivera",
          finalizedAt: "31 dic 2026, 10:30",
        },
      ],
      prescriptions: [],
      generatedDate: "31 dic 2026",
    }).output();

    expect(output).toContain("RESUMEN DEL EXPEDIENTE CLÍNICO");
    expect(output).toContain("Información del paciente");
    expect(output).toContain("finalizada por");
    expect(output).not.toContain("MEDICAL RECORD SUMMARY");
    expect(output).not.toContain("Finalized by");
    expect(output).not.toContain(" on 31 dic 2026");
    expect(output).toContain("Owner reports improved appetite.");
  });

  it("scales the shared CRC vector glyph across amounts and report pages", () => {
    const source = readFileSync("lib/pdf.ts", "utf8");
    expect(source).toContain(
      "const fontSizeMm = doc.getFontSize() / doc.internal.scaleFactor",
    );
    expect(source).toContain("const height = fontSizeMm * 0.82");
    expect(source).toContain("doc.setLineCap(\"round\")");
    expect(source).toContain("doc.setLineJoin(\"round\")");

    const doc = generateReportPdf({
      language: "es",
      title: "Reporte de ingresos",
      columns: ["Monto"],
      rows: [
        ["₡0,00"],
        ["₡390,00"],
        ["₡3 390,00"],
        ["₡112 571,58"],
        ...Array.from({ length: 36 }, (_, index) => [`₡${index + 1},00`]),
      ],
      generatedDate: "31/12/2026",
    });

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output()).not.toContain("¡");
  });
});
