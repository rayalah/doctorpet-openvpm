import jsPDF from "jspdf";
import { soapSectionText } from "@/lib/records/soap-content";
import { createTranslator } from "@/lib/i18n/messages";
import type { SupportedLanguage } from "@/lib/i18n/language";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const COLOR_TEAL = "#0d9488";
const COLOR_DARK = "#333333";
const COLOR_GRAY = "#666666";
const COLOR_LIGHT_GRAY = "#eeeeee";
const FONT = "helvetica";
const PAGE_MARGIN = 20; // mm
const PAGE_WIDTH = 210; // A4 / letter approximate usable width
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function setColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
  // Currency glyphs are drawn as vector lines, so keep their stroke color in
  // lockstep with the text color instead of inheriting a previous table rule.
  doc.setDrawColor(r, g, b);
}

function drawLine(doc: jsPDF, y: number) {
  const [r, g, b] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
}

/**
 * Check remaining space on page; add a new page if needed.
 * Returns the (potentially reset) y position.
 */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

function formatGeneratedDateUtc(language: SupportedLanguage = "en"): string {
  return new Date().toLocaleDateString(language === "es" ? "es-CR" : "en-US", {
    timeZone: "UTC",
  });
}

/**
 * jsPDF's built-in Helvetica uses WinAnsi and has no U+20A1 glyph. In that
 * font the CRC sign can be substituted with a misleading character (notably
 * `¡`). Draw the small currency glyph as vector geometry while keeping the
 * numeric text in the selected PDF font. This keeps all existing PDF inputs
 * and currency calculations unchanged and works in every supported renderer.
 */
function crcGlyphMetrics(doc: jsPDF) {
  // jsPDF reports font size in points while the document coordinates are mm.
  // Derive every dimension from the active font so the glyph remains legible
  // when a table or total changes font size.
  const fontSizeMm = doc.getFontSize() / doc.internal.scaleFactor;
  const height = fontSizeMm * 0.82;
  const width = fontSizeMm * 0.62;
  return {
    height,
    width,
    advance: width + fontSizeMm * 0.14,
    stroke: Math.max(0.24, fontSizeMm * 0.12),
  };
}

function drawCrcGlyph(doc: jsPDF, centerX: number, baselineY: number) {
  const { height, width, stroke } = crcGlyphMetrics(doc);
  const centerY = baselineY - height * 0.49;
  const radiusX = width * 0.5;
  const radiusY = height * 0.43;
  const startAngle = -Math.PI / 4;
  const sweep = (3 * Math.PI) / 2;
  const startX = centerX + radiusX * Math.cos(startAngle);
  const startY = centerY + radiusY * Math.sin(startAngle);

  doc.setLineWidth(stroke);
  doc.setLineCap("round");
  doc.setLineJoin("round");

  // Approximate the open-right C with short straight segments. The arc and
  // bars scale with the active font and share the text baseline.
  const arcPoints = 12;
  let previousX = startX;
  let previousY = startY;
  for (let index = 1; index <= arcPoints; index++) {
    const angle = startAngle - (sweep * index) / arcPoints;
    const nextX = centerX + radiusX * Math.cos(angle);
    const nextY = centerY + radiusY * Math.sin(angle);
    doc.line(previousX, previousY, nextX, nextY);
    previousX = nextX;
    previousY = nextY;
  }

  // The Costa Rican colón is a C with a vertical stroke, not a pair of
  // horizontal currency bars (which would make the mark look like €).
  doc.line(
    centerX + width * 0.04,
    baselineY - height * 0.9,
    centerX + width * 0.04,
    baselineY + height * 0.04,
  );

  // Do not leak the rounded cap/join style into subsequent document lines.
  doc.setLineCap("butt");
  doc.setLineJoin("miter");
}

function drawPdfText(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  options?: { align?: "left" | "center" | "right" },
) {
  if (!value.includes("₡")) {
    doc.text(value, x, y, options);
    return;
  }

  const align = options?.align ?? "left";
  const parts = value.split("₡");
  const { advance } = crcGlyphMetrics(doc);
  const totalWidth = parts.reduce(
    (width, part) => width + doc.getTextWidth(part),
    advance * (parts.length - 1),
  );
  const startX = align === "right" ? x - totalWidth : align === "center" ? x - totalWidth / 2 : x;
  let cursorX = startX;
  parts.forEach((part, index) => {
    if (part) {
      doc.text(part, cursorX, y);
      cursorX += doc.getTextWidth(part);
    }
    if (index < parts.length - 1) {
      drawCrcGlyph(doc, cursorX + advance / 2, y);
      cursorX += advance;
    }
  });
}

/** Optional in-memory tenant logo. Callers remain compatible when omitted. */
export type PdfBranding = {
  tenantLogoDataUrl?: string;
};

function drawOptionalTenantLogo(doc: jsPDF, branding?: PdfBranding) {
  if (!branding?.tenantLogoDataUrl) return;
  try {
    doc.addImage(branding.tenantLogoDataUrl, "PNG", PAGE_MARGIN, 10, 18, 18);
  } catch {
    // A tenant logo must never prevent a clinical or financial document download.
  }
}

function drawPlatformFooter(
  doc: jsPDF,
  y: number,
  align: "center" | "left" = "center",
  language: SupportedLanguage = "en",
) {
  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  setColor(doc, COLOR_GRAY);
  doc.text(
    createTranslator(language)("branding.documentPlatform"),
    align === "center" ? PAGE_WIDTH / 2 : PAGE_MARGIN,
    y,
    { align },
  );
}

/**
 * Brand mark: a white paw print on a teal rounded square, drawn with
 * primitives so PDFs need no image asset. Matches the in-app brand color.
 */
function drawPawMark(doc: jsPDF, x: number, y: number, size: number) {
  const [r, g, b] = hexToRgb(COLOR_TEAL);
  doc.setFillColor(r, g, b);
  doc.roundedRect(x, y, size, size, size * 0.22, size * 0.22, "F");

  doc.setFillColor(255, 255, 255);
  const cx = x + size / 2;
  const s = size / 12;
  // Main pad
  doc.ellipse(cx, y + 7.7 * s, 2.7 * s, 2.2 * s, "F");
  // Four toes
  doc.circle(cx - 3.3 * s, y + 4.7 * s, 1.15 * s, "F");
  doc.circle(cx - 1.15 * s, y + 3.5 * s, 1.15 * s, "F");
  doc.circle(cx + 1.15 * s, y + 3.5 * s, 1.15 * s, "F");
  doc.circle(cx + 3.3 * s, y + 4.7 * s, 1.15 * s, "F");
}

// ---------------------------------------------------------------------------
// 1. Invoice PDF
// ---------------------------------------------------------------------------

export interface InvoiceData {
  language?: SupportedLanguage;
  branding?: PdfBranding;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  patientName?: string;
  invoiceDate: string;
  dueDate?: string;
  status: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  subtotal: string;
  tax: string;
  total: string;
  paidAmount: string;
  /** Pre-formatted balance due (region-aware currency). Falls back to total − paid. */
  balanceDue?: string;
}

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const language = data.language ?? "en";
  const t = createTranslator(language);
  let y = PAGE_MARGIN;
  drawOptionalTenantLogo(doc, data.branding);

  // --- Header: Practice info -------------------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName, PAGE_MARGIN, y);
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(data.practiceAddress, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practiceEmail) {
    doc.text(data.practiceEmail, PAGE_MARGIN, y);
    y += 4;
  }

  // --- INVOICE title (right-aligned) -----------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(28);
  setColor(doc, COLOR_DARK);
  doc.text(t("documents.invoice"), PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN, {
    align: "right",
  });

  // Status badge
  doc.setFontSize(10);
  const statusLabels: Record<string, Parameters<typeof t>[0]> = {
    draft: "billing.draft",
    sent: "billing.sent",
    paid: "billing.paid",
    overdue: "billing.overdue",
    void: "billing.void",
    estimate: "billing.estimate",
  };
  const statusLabel = t(statusLabels[data.status] ?? "billing.unknownStatus").toUpperCase();
  const statusWidth = doc.getTextWidth(statusLabel) + 8;
  const statusX = PAGE_WIDTH - PAGE_MARGIN - statusWidth;
  const statusY = PAGE_MARGIN + 6;
  const [tr, tg, tb] = hexToRgb(COLOR_TEAL);
  doc.setFillColor(tr, tg, tb);
  doc.roundedRect(statusX, statusY, statusWidth, 7, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, statusX + statusWidth / 2, statusY + 5, {
    align: "center",
  });

  // Date info right side
  setColor(doc, COLOR_GRAY);
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  let dateY = statusY + 12;
  doc.text(`${t("documents.date")}: ${data.invoiceDate}`, PAGE_WIDTH - PAGE_MARGIN, dateY, {
    align: "right",
  });
  if (data.dueDate) {
    dateY += 4;
    doc.text(`${t("documents.due")}: ${data.dueDate}`, PAGE_WIDTH - PAGE_MARGIN, dateY, {
      align: "right",
    });
  }

  y = Math.max(y, dateY) + 8;
  drawLine(doc, y);
  y += 8;

  // --- Bill To ---------------------------------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(t("documents.billTo"), PAGE_MARGIN, y);
  y += 5;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);
  doc.text(data.clientName, PAGE_MARGIN, y);
  y += 5;
  if (data.clientAddress) {
    doc.text(data.clientAddress, PAGE_MARGIN, y);
    y += 5;
  }
  if (data.clientEmail) {
    doc.text(data.clientEmail, PAGE_MARGIN, y);
    y += 5;
  }
  if (data.patientName) {
    y += 2;
    doc.setFont(FONT, "italic");
    setColor(doc, COLOR_DARK);
    doc.text(`${t("documents.patient")}: ${data.patientName}`, PAGE_MARGIN, y);
    y += 5;
  }

  y += 6;

  // --- Line Items Table ------------------------------------------------------
  const colX = {
    desc: PAGE_MARGIN,
    qty: PAGE_MARGIN + CONTENT_WIDTH * 0.55,
    unit: PAGE_MARGIN + CONTENT_WIDTH * 0.7,
    total: PAGE_WIDTH - PAGE_MARGIN,
  };

  // Table header
  const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setFillColor(lr, lg, lb);
  doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  doc.text(t("documents.description"), colX.desc + 2, y);
  doc.text(t("documents.quantity"), colX.qty, y, { align: "center" });
  doc.text(t("documents.unitPrice"), colX.unit, y, { align: "center" });
  doc.text(t("documents.total"), colX.total - 2, y, { align: "right" });
  y += 8;

  // Table rows
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_DARK);
  for (const item of data.items) {
    y = ensureSpace(doc, y, 8);
    doc.text(item.description, colX.desc + 2, y);
    doc.text(String(item.quantity), colX.qty, y, { align: "center" });
    drawPdfText(doc, item.unitPrice, colX.unit, y, { align: "center" });
    drawPdfText(doc, item.total, colX.total - 2, y, { align: "right" });
    y += 6;
  }

  y += 4;
  drawLine(doc, y);
  y += 8;

  // --- Totals ----------------------------------------------------------------
  const totalsX = PAGE_WIDTH - PAGE_MARGIN - 60;
  const totalsValX = PAGE_WIDTH - PAGE_MARGIN;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);

  doc.text(`${t("documents.subtotal")}:`, totalsX, y);
  drawPdfText(doc, data.subtotal, totalsValX, y, { align: "right" });
  y += 6;

  doc.text(`${t("documents.tax")}:`, totalsX, y);
  drawPdfText(doc, data.tax, totalsValX, y, { align: "right" });
  y += 6;

  drawLine(doc, y);
  y += 6;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_DARK);
  doc.text(`${t("documents.total")}:`, totalsX, y);
  drawPdfText(doc, data.total, totalsValX, y, { align: "right" });
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_GRAY);
  doc.text(`${t("documents.paidAmount")}:`, totalsX, y);
  drawPdfText(doc, data.paidAmount, totalsValX, y, { align: "right" });
  y += 6;

  // Balance due — prefer the caller's region-formatted value; otherwise derive
  // it from total − paid (legacy callers without a currency context).
  const balanceParts = [data.total, data.paidAmount].map((v) =>
    parseFloat(v.replace(/[^0-9.-]/g, ""))
  );
  const currencyPrefix = data.total.match(/^[^0-9-]*/)?.[0] || "$";
  const balance =
    data.balanceDue ?? `${currencyPrefix}${(balanceParts[0]! - balanceParts[1]!).toFixed(2)}`;
  doc.setFont(FONT, "bold");
  setColor(doc, COLOR_TEAL);
  doc.text(`${t("documents.balanceDue")}:`, totalsX, y);
  drawPdfText(doc, balance, totalsValX, y, { align: "right" });

  // --- Footer ----------------------------------------------------------------
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  doc.text(
    t("documents.thankYou"),
    PAGE_WIDTH / 2,
    pageHeight - 15,
    { align: "center" }
  );
  drawPlatformFooter(doc, pageHeight - 10, "center", language);

  return doc;
}

// ---------------------------------------------------------------------------
// 2. Prescription Label PDF
// ---------------------------------------------------------------------------

export interface PrescriptionLabelData {
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  clientName: string;
  species: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedBy: string;
  startDate: string;
  quantity?: string;
  refillsRemaining?: number;
}

export function generatePrescriptionLabelPdf(
  data: PrescriptionLabelData
): jsPDF {
  // 4" x 2" landscape at 72 DPI  ➜  288 x 144 points
  const doc = new jsPDF({ format: [144, 288], orientation: "landscape" });

  // Convert points to mm for internal use (1 pt = 0.3528 mm)
  const W = 288 * 0.3528; // ~101.6 mm
  const H = 144 * 0.3528; // ~50.8 mm
  const M = 4; // margin in mm
  let y = M + 3;

  // Practice info
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName, W / 2, y, { align: "center" });
  y += 3.5;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_GRAY);
    doc.text(data.practicePhone, W / 2, y, { align: "center" });
    y += 3;
  }

  // Divider
  const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(lr, lg, lb);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 3;

  // Patient / Client
  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  setColor(doc, COLOR_DARK);
  doc.text(`Patient: ${data.patientName} (${data.species})`, M, y);
  doc.text(`Owner: ${data.clientName}`, W - M, y, { align: "right" });
  y += 4;

  // Medication (bold, larger)
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(data.medicationName, M, y);
  y += 4;

  // Dosage & frequency
  doc.setFontSize(8);
  doc.text(`${data.dosage}  —  ${data.frequency}`, M, y);
  y += 4;

  // Instructions
  if (data.instructions) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_DARK);
    const lines = doc.splitTextToSize(data.instructions, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 3;
  }

  y += 1;

  // Prescriber & date
  doc.setFont(FONT, "normal");
  doc.setFontSize(6.5);
  setColor(doc, COLOR_GRAY);
  doc.text(`Prescribed by: ${data.prescribedBy}`, M, y);
  doc.text(`Date: ${data.startDate}`, W - M, y, { align: "right" });
  y += 3;

  // Quantity & refills
  const extras: string[] = [];
  if (data.quantity) extras.push(`Qty: ${data.quantity}`);
  if (data.refillsRemaining !== undefined)
    extras.push(`Refills: ${data.refillsRemaining}`);
  if (extras.length > 0) {
    doc.text(extras.join("   |   "), M, y);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 3. Medical Record Summary PDF
// ---------------------------------------------------------------------------

export interface MedicalSummaryData {
  language?: SupportedLanguage;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  breed?: string;
  sex?: string;
  dob?: string;
  color?: string;
  microchip?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  allergies: Array<{
    allergen: string;
    severity: string;
    reaction?: string;
  }>;
  problems: Array<{ description: string; status: string; onsetDate?: string }>;
  vaccinations: Array<{ name: string; date: string; nextDue?: string }>;
  recentNotes: Array<{
    date: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    imported?: boolean;
    authorName?: string;
    finalizerName?: string;
    finalizedAt?: string;
    replacementForLabel?: string;
    addenda?: Array<{ content: string; authorName: string; createdAt: string }>;
  }>;
  recordCorrections?: Array<{
    recordLabel: string;
    reason: string;
    correctedByName: string;
    correctedAt: string;
    replacementLabel?: string;
  }>;
  prescriptions: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    status: string;
  }>;
  generatedDate?: string;
}

export function generateMedicalSummaryPdf(data: MedicalSummaryData): jsPDF {
  const doc = new jsPDF();
  const language = data.language ?? "en";
  const t = createTranslator(language);
  let y = PAGE_MARGIN;

  function writeWrappedText(
    value: string,
    x: number,
    width: number,
    lineHeight = 4,
  ) {
    const lines = doc.splitTextToSize(value, width) as string[];
    for (const line of lines) {
      y = ensureSpace(doc, y, lineHeight + 1);
      doc.text(line, x, y);
      y += lineHeight;
    }
  }

  // ---- Helper: section heading ---------------------------------------------
  function sectionHeading(title: string) {
    y = ensureSpace(doc, y, 16);
    y += 4;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_TEAL);
    doc.text(title, PAGE_MARGIN, y);
    y += 2;
    const [r, g, b] = hexToRgb(COLOR_TEAL);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
    y += 6;
  }

  // ---- Header ---------------------------------------------------------------
  // Stacked top to bottom (logo, clinic name, document title) so any
  // clinic-name length fits without colliding with the title.
  const logoSize = 12;
  drawPawMark(doc, PAGE_MARGIN, y, logoSize);
  y += logoSize + 8;

  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  const nameLines = doc.splitTextToSize(data.practiceName, CONTENT_WIDTH);
  doc.text(nameLines, PAGE_MARGIN, y);
  y += nameLines.length * 8;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(data.practiceAddress, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  y += 4;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_DARK);
  doc.text(t("documents.medicalRecordSummary"), PAGE_MARGIN, y);

  y += 3;
  drawLine(doc, y);
  y += 8;

  // ---- Patient Info ---------------------------------------------------------
  sectionHeading(t("documents.patientInformation"));

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  const patientFields: [string, string | undefined][] = [
    [t("documents.name"), data.patientName],
    [t("documents.species"), data.species],
    [t("documents.breed"), data.breed],
    [t("documents.sex"), data.sex],
    [t("documents.dateOfBirth"), data.dob],
    [t("documents.color"), data.color],
    [t("documents.microchip"), data.microchip],
  ];

  const colMid = PAGE_MARGIN + CONTENT_WIDTH / 2;
  let col = 0;
  for (const [label, value] of patientFields) {
    if (value === undefined) continue;
    const xPos = col === 0 ? PAGE_MARGIN : colMid;
    doc.setFont(FONT, "bold");
    doc.text(`${label}: `, xPos, y);
    const labelW = doc.getTextWidth(`${label}: `);
    doc.setFont(FONT, "normal");
    doc.text(value, xPos + labelW, y);
    col++;
    if (col === 2) {
      col = 0;
      y += 6;
    }
  }
  if (col !== 0) y += 6;

  // ---- Owner Info -----------------------------------------------------------
  sectionHeading(t("documents.ownerInformation"));

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  doc.setFont(FONT, "bold");
  doc.text(`${t("documents.name")}: `, PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(data.clientName, PAGE_MARGIN + doc.getTextWidth(`${t("documents.name")}: `), y);
  y += 6;

  if (data.clientPhone) {
    doc.setFont(FONT, "bold");
    doc.text(`${t("documents.phone")}: `, PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(
      data.clientPhone,
      PAGE_MARGIN + doc.getTextWidth(`${t("documents.phone")}: `),
      y
    );
    y += 6;
  }
  if (data.clientEmail) {
    doc.setFont(FONT, "bold");
    doc.text(`${t("documents.email")}: `, PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(
      data.clientEmail,
      PAGE_MARGIN + doc.getTextWidth(`${t("documents.email")}: `),
      y
    );
    y += 6;
  }

  // ---- Allergies ------------------------------------------------------------
  if (data.allergies.length > 0) {
    sectionHeading(t("documents.allergies"));

    doc.setFontSize(10);
    for (const allergy of data.allergies) {
      y = ensureSpace(doc, y, 8);
      // Highlight background for allergies
      const [ar, ag, ab] = hexToRgb("#fef2f2"); // light red
      doc.setFillColor(ar, ag, ab);
      doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 7, "F");

      doc.setFont(FONT, "bold");
      setColor(doc, "#dc2626");
      doc.text(allergy.allergen, PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      doc.text(`(${allergy.severity})`, PAGE_MARGIN + 2 + doc.getTextWidth(allergy.allergen + " "), y);
      y += 5;
      if (allergy.reaction) {
        doc.setFontSize(8);
        writeWrappedText(
          `${t("documents.reaction")}: ${allergy.reaction}`,
          PAGE_MARGIN + 2,
          CONTENT_WIDTH - 4,
          3.5,
        );
        doc.setFontSize(10);
      }
      y += 3;
    }
  }

  // ---- Active Problems ------------------------------------------------------
  if (data.problems.length > 0) {
    sectionHeading(t("documents.activeProblems"));

    doc.setFontSize(10);
    for (const problem of data.problems) {
      y = ensureSpace(doc, y, 8);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_DARK);
      let text = `• ${problem.description}`;
      if (problem.onsetDate) text += ` (${t("documents.onset")}: ${problem.onsetDate})`;
      doc.text(text, PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "italic");
      setColor(doc, COLOR_GRAY);
      doc.text(`[${problem.status}]`, PAGE_WIDTH - PAGE_MARGIN, y, {
        align: "right",
      });
      y += 6;
    }
  }

  // ---- Vaccination History --------------------------------------------------
  if (data.vaccinations.length > 0) {
    sectionHeading(t("documents.vaccinationHistory"));

    // Table header
    const vColName = PAGE_MARGIN;
    const vColDate = PAGE_MARGIN + CONTENT_WIDTH * 0.5;
    const vColNext = PAGE_WIDTH - PAGE_MARGIN;

    const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr, lg, lb);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text(t("documents.vaccine"), vColName + 2, y);
    doc.text(t("documents.dateGiven"), vColDate, y);
    doc.text(t("documents.nextDue"), vColNext - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const vax of data.vaccinations) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(vax.name, vColName + 2, y);
      doc.text(vax.date, vColDate, y);
      setColor(doc, COLOR_GRAY);
      doc.text(vax.nextDue ?? "—", vColNext - 2, y, { align: "right" });
      y += 6;
    }
  }

  // ---- Recent SOAP Notes ----------------------------------------------------
  if (data.recentNotes.length > 0) {
    sectionHeading(t("documents.recentSoapNotes"));

    const notesToShow = data.recentNotes.slice(0, 5);
    for (const note of notesToShow) {
      y = ensureSpace(doc, y, 30);

      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      setColor(doc, COLOR_DARK);
      doc.text(
        note.imported
          ? `${note.date}  (${t("documents.finalizedImportedRecord")})`
          : `${note.date}  (${t("documents.finalized")})`,
        PAGE_MARGIN,
        y
      );
      y += 6;

      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      setColor(doc, COLOR_GRAY);
      const attribution = note.imported
        ? `${t("documents.importedBy")} ${note.authorName ?? t("documents.unknownClinician")}`
        : `${t("documents.authoredBy")} ${note.authorName ?? t("documents.unknownClinician")}; ${t("documents.finalizedBy")} ${note.finalizerName ?? t("documents.unknownClinician")}${note.finalizedAt ? ` ${t("documents.on")} ${note.finalizedAt}` : ""}`;
      writeWrappedText(attribution, PAGE_MARGIN, CONTENT_WIDTH);
      y += 2;
      if (note.replacementForLabel) {
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        writeWrappedText(
          `${t("documents.signedReplacementFor")} ${note.replacementForLabel}`,
          PAGE_MARGIN,
          CONTENT_WIDTH,
        );
        y += 2;
      }

      doc.setFontSize(9);
      const soapSections: [string, string | undefined][] = [
        ["S: ", soapSectionText(note.subjective)],
        ["O: ", soapSectionText(note.objective)],
        ["A: ", soapSectionText(note.assessment)],
        ["P: ", soapSectionText(note.plan)],
      ];

      for (const [prefix, content] of soapSections) {
        if (!content) continue;
        y = ensureSpace(doc, y, 10);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        doc.text(prefix, PAGE_MARGIN + 4, y);
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_DARK);
        writeWrappedText(content, PAGE_MARGIN + 14, CONTENT_WIDTH - 14);
        y += 2;
      }

      for (const addendum of note.addenda ?? []) {
        y = ensureSpace(doc, y, 14);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        writeWrappedText(
          `${t("documents.addendum")} - ${addendum.authorName}, ${addendum.createdAt}`,
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
          5,
        );
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_DARK);
        writeWrappedText(
          soapSectionText(addendum.content),
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
        );
        y += 2;
      }

      y += 4;
      drawLine(doc, y);
      y += 4;
    }
  }

  // Invalidated clinical content stays excluded, while its durable correction
  // evidence remains visible to a downstream clinician reviewing the summary.
  if ((data.recordCorrections?.length ?? 0) > 0) {
    sectionHeading(t("documents.recordCorrections"));
    for (const correction of data.recordCorrections ?? []) {
      y = ensureSpace(doc, y, 18);
      doc.setFont(FONT, "bold");
      doc.setFontSize(9);
      setColor(doc, COLOR_DARK);
      writeWrappedText(
        correction.recordLabel,
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      writeWrappedText(
        `${t("documents.enteredInErrorBy")} ${correction.correctedByName} ${t("documents.on")} ${correction.correctedAt}`,
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      setColor(doc, COLOR_DARK);
      writeWrappedText(
        `${t("documents.reason")}: ${soapSectionText(correction.reason)}`,
        PAGE_MARGIN + 4,
        CONTENT_WIDTH - 8,
      );
      if (correction.replacementLabel) {
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        writeWrappedText(
          `${t("documents.signedReplacement")}: ${correction.replacementLabel}`,
          PAGE_MARGIN + 4,
          CONTENT_WIDTH - 8,
        );
      }
      y += 3;
    }
  }

  // ---- Current Prescriptions ------------------------------------------------
  if (data.prescriptions.length > 0) {
    sectionHeading(t("documents.currentPrescriptions"));

    // Table header
    const pColMed = PAGE_MARGIN;
    const pColDose = PAGE_MARGIN + CONTENT_WIDTH * 0.35;
    const pColFreq = PAGE_MARGIN + CONTENT_WIDTH * 0.6;
    const pColStat = PAGE_WIDTH - PAGE_MARGIN;

    const [lr2, lg2, lb2] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr2, lg2, lb2);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text(t("documents.medication"), pColMed + 2, y);
    doc.text(t("documents.dosage"), pColDose, y);
    doc.text(t("documents.frequency"), pColFreq, y);
    doc.text(t("documents.status"), pColStat - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const rx of data.prescriptions) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(rx.medication, pColMed + 2, y);
      doc.text(rx.dosage, pColDose, y);
      doc.text(rx.frequency, pColFreq, y);
      setColor(doc, COLOR_GRAY);
      doc.text(rx.status, pColStat - 2, y, { align: "right" });
      y += 6;
    }
  }

  // ---- Footer ---------------------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  const generatedDate = data.generatedDate ?? formatGeneratedDateUtc(language);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(FONT, "italic");
    doc.setFontSize(8);
    setColor(doc, COLOR_GRAY);
    doc.text(
      `${t("documents.generatedOn")} ${generatedDate} — ${t("documents.referenceOnly")}`,
      PAGE_WIDTH / 2,
      pageHeight - 10,
      { align: "center" }
    );
    doc.text(
      t("documents.pageOf").replace("{page}", String(i)).replace("{pages}", String(pageCount)),
      PAGE_WIDTH - PAGE_MARGIN,
      pageHeight - 10,
      { align: "right" },
    );
    drawPlatformFooter(doc, pageHeight - 5, "left", language);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 4. Vaccination Certificate
// ---------------------------------------------------------------------------

export interface VaccinationCertificateData {
  branding?: PdfBranding;
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  patientName: string;
  species: string;
  breed?: string;
  sex?: string;
  dob?: string;
  color?: string;
  clientName: string;
  vaccineName: string;
  administeredAt: string;
  nextDueDate?: string;
  manufacturer?: string;
  lotNumber?: string;
  generatedDate?: string;
}

export function generateVaccinationCertificatePdf(
  data: VaccinationCertificateData
): jsPDF {
  const doc = new jsPDF();
  let y = PAGE_MARGIN;
  drawOptionalTenantLogo(doc, data.branding);

  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName || "Veterinary Practice", PAGE_MARGIN, y);
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(data.practiceAddress, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practiceEmail) {
    doc.text(data.practiceEmail, PAGE_MARGIN, y);
    y += 4;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_DARK);
  doc.text("VACCINATION CERTIFICATE", PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN, {
    align: "right",
  });

  y = Math.max(y, PAGE_MARGIN + 14) + 4;
  drawLine(doc, y);
  y += 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_TEAL);
  doc.text("Patient", PAGE_MARGIN, y);
  doc.text("Owner", PAGE_MARGIN + CONTENT_WIDTH / 2, y);
  y += 6;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  const patientLines = [
    data.patientName,
    [data.breed, data.species].filter(Boolean).join(" / "),
    data.sex,
    data.dob ? `DOB: ${data.dob}` : undefined,
    data.color ? `Color: ${data.color}` : undefined,
  ].filter(Boolean) as string[];
  doc.text(patientLines, PAGE_MARGIN, y);
  doc.text(data.clientName, PAGE_MARGIN + CONTENT_WIDTH / 2, y);
  y += Math.max(patientLines.length, 1) * 5 + 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  setColor(doc, COLOR_TEAL);
  doc.text("Vaccination Record", PAGE_MARGIN, y);
  y += 6;

  const rows: [string, string | undefined][] = [
    ["Vaccine", data.vaccineName],
    ["Administered", data.administeredAt],
    ["Next due", data.nextDueDate],
    ["Manufacturer", data.manufacturer],
    ["Lot number", data.lotNumber],
  ];

  doc.setFontSize(10);
  for (const [label, value] of rows) {
    if (!value) continue;
    y = ensureSpace(doc, y, 8);
    doc.setFont(FONT, "bold");
    setColor(doc, COLOR_DARK);
    doc.text(`${label}:`, PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(value, PAGE_MARGIN + 36, y);
    y += 7;
  }

  y += 8;
  drawLine(doc, y);
  y += 8;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  const note =
    "This certificate reflects the vaccination record currently available in the client portal.";
  doc.text(doc.splitTextToSize(note, CONTENT_WIDTH), PAGE_MARGIN, y);

  const generatedDate = data.generatedDate ?? formatGeneratedDateUtc();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  doc.text(`Generated on ${generatedDate}`, PAGE_WIDTH / 2, pageHeight - 10, {
    align: "center",
  });
  drawPlatformFooter(doc, pageHeight - 6);

  return doc;
}

// ---------------------------------------------------------------------------
// 5. Generic Report PDF
// ---------------------------------------------------------------------------

export type ReportPdfCell = string | number | null | undefined;

export interface ReportPdfData {
  language?: SupportedLanguage;
  title: string;
  subtitle?: string;
  columns: string[];
  rows: ReportPdfCell[][];
  emptyMessage?: string;
  generatedDate?: string;
}

export function generateReportPdf(data: ReportPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: data.columns.length > 4 ? "landscape" : "portrait",
  });
  const language = data.language ?? "en";
  const t = createTranslator(language);
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const colWidth = contentWidth / Math.max(data.columns.length, 1);
  let y = margin;

  function addPageIfNeeded(needed: number) {
    if (y + needed <= pageHeight - 18) return;
    doc.addPage();
    y = margin;
    drawTableHeader();
  }

  function drawTableHeader() {
    const [r, g, b] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(r, g, b);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    setColor(doc, COLOR_DARK);
    data.columns.forEach((column, index) => {
      doc.text(column, margin + index * colWidth + 2, y);
    });
    y += 8;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_TEAL);
  doc.text(data.title, margin, y);
  y += 7;

  if (data.subtitle) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    doc.text(data.subtitle, margin, y);
    y += 5;
  }

  const [reportLineR, reportLineG, reportLineB] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(reportLineR, reportLineG, reportLineB);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (data.rows.length === 0) {
    doc.setFont(FONT, "italic");
    doc.setFontSize(10);
    setColor(doc, COLOR_GRAY);
    doc.text(data.emptyMessage ?? t("pdf.noData"), margin, y);
  } else {
    drawTableHeader();
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);

    for (const row of data.rows) {
      const cellLines = data.columns.map((_, index) =>
        doc.splitTextToSize(String(row[index] ?? ""), colWidth - 4)
      );
      const rowHeight =
        Math.max(...cellLines.map((lines) => lines.length), 1) * 4 + 4;
      addPageIfNeeded(rowHeight);
      setColor(doc, COLOR_DARK);
      cellLines.forEach((lines, index) => {
        if (lines.length === 1) {
          drawPdfText(doc, lines[0]!, margin + index * colWidth + 2, y);
        } else {
          doc.text(lines, margin + index * colWidth + 2, y);
        }
      });
      y += rowHeight;
    }
  }

  const generatedDate = data.generatedDate ?? formatGeneratedDateUtc(language);
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "italic");
    doc.setFontSize(8);
    setColor(doc, COLOR_GRAY);
    doc.text(`${t("documents.generatedOn")} ${generatedDate}`, pageWidth / 2, pageHeight - 8, {
      align: "center",
    });
    doc.text(
      t("documents.pageOf").replace("{page}", String(i)).replace("{pages}", String(pageCount)),
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" },
    );
    drawPlatformFooter(doc, pageHeight - 3, "left", language);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 6. Discharge Instructions
// ---------------------------------------------------------------------------

export interface DischargeInstructionsData {
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  clientName: string;
  visitDate: string;
  doctorName?: string;
  diagnosis?: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    instructions?: string;
  }>;
  instructions: string[];
  followUpDate?: string;
  followUpNotes?: string;
  restrictions?: string[];
  emergencyNotes?: string;
}

export function generateDischargeInstructions(
  data: DischargeInstructionsData
): jsPDF {
  const doc = new jsPDF();
  let y = PAGE_MARGIN;

  // Header
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName || "Veterinary Practice", PAGE_MARGIN, y);
  y += 6;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  y += 4;

  // Title
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_DARK);
  doc.text("DISCHARGE INSTRUCTIONS", PAGE_MARGIN, y);
  y += 10;
  drawLine(doc, y);
  y += 8;

  // Patient & Visit Info
  doc.setFontSize(10);
  doc.setFont(FONT, "bold");
  setColor(doc, COLOR_DARK);
  doc.text("Patient:", PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(`${data.patientName} (${data.species})`, PAGE_MARGIN + 22, y);

  doc.setFont(FONT, "bold");
  doc.text("Owner:", PAGE_WIDTH / 2, y);
  doc.setFont(FONT, "normal");
  doc.text(data.clientName, PAGE_WIDTH / 2 + 20, y);
  y += 6;

  doc.setFont(FONT, "bold");
  doc.text("Visit Date:", PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(data.visitDate, PAGE_MARGIN + 28, y);

  if (data.doctorName) {
    doc.setFont(FONT, "bold");
    doc.text("Doctor:", PAGE_WIDTH / 2, y);
    doc.setFont(FONT, "normal");
    doc.text(data.doctorName, PAGE_WIDTH / 2 + 20, y);
  }
  y += 10;

  // Diagnosis
  if (data.diagnosis) {
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Diagnosis", PAGE_MARGIN, y);
    y += 6;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    const diagLines = doc.splitTextToSize(data.diagnosis, CONTENT_WIDTH);
    doc.text(diagLines, PAGE_MARGIN, y);
    y += diagLines.length * 5 + 6;
  }

  // Medications
  if (data.medications.length > 0) {
    y = ensureSpace(doc, y, 30);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Medications", PAGE_MARGIN, y);
    y += 8;

    for (const med of data.medications) {
      y = ensureSpace(doc, y, 20);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      doc.text(`${med.name} — ${med.dosage}`, PAGE_MARGIN + 4, y);
      y += 5;
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      doc.text(`Frequency: ${med.frequency}`, PAGE_MARGIN + 4, y);
      y += 5;
      if (med.instructions) {
        const instrLines = doc.splitTextToSize(med.instructions, CONTENT_WIDTH - 8);
        setColor(doc, COLOR_DARK);
        doc.text(instrLines, PAGE_MARGIN + 4, y);
        y += instrLines.length * 5;
      }
      y += 4;
    }
  }

  // Care Instructions
  if (data.instructions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Care Instructions", PAGE_MARGIN, y);
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const instruction of data.instructions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(`• ${instruction}`, CONTENT_WIDTH - 4);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Restrictions
  if (data.restrictions && data.restrictions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Restrictions", PAGE_MARGIN, y);
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const restriction of data.restrictions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(`• ${restriction}`, CONTENT_WIDTH - 4);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Follow-up
  if (data.followUpDate || data.followUpNotes) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Follow-Up", PAGE_MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    if (data.followUpDate) {
      doc.setFont(FONT, "bold");
      doc.text("Scheduled:", PAGE_MARGIN + 4, y);
      doc.setFont(FONT, "normal");
      doc.text(data.followUpDate, PAGE_MARGIN + 30, y);
      y += 6;
    }
    if (data.followUpNotes) {
      doc.setFont(FONT, "normal");
      const lines = doc.splitTextToSize(data.followUpNotes, CONTENT_WIDTH - 8);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5;
    }
    y += 6;
  }

  // Emergency notes
  if (data.emergencyNotes) {
    y = ensureSpace(doc, y, 25);
    drawLine(doc, y);
    y += 6;
    const [r, g, b] = hexToRgb("#dc2626");
    doc.setTextColor(r, g, b);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text("WHEN TO SEEK EMERGENCY CARE", PAGE_MARGIN, y);
    y += 7;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    setColor(doc, COLOR_DARK);
    const emergLines = doc.splitTextToSize(data.emergencyNotes, CONTENT_WIDTH);
    doc.text(emergLines, PAGE_MARGIN, y);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "italic");
  doc.setFontSize(8);
  setColor(doc, COLOR_GRAY);
  doc.text(
    "If you have any questions or concerns, please contact our office.",
    PAGE_WIDTH / 2,
    pageHeight - 15,
    { align: "center" }
  );
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_WIDTH / 2, pageHeight - 10, {
      align: "center",
    });
  }

  return doc;
}
