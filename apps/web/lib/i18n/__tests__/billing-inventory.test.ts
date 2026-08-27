import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTranslator } from "../messages";
import { enBillingMessages, esBillingMessages } from "../messages/billing";
import { enInventoryMessages, esInventoryMessages } from "../messages/inventory";
import { getInventoryCategoryLabel } from "../../inventory/categories";

describe("billing and inventory i18n", () => {
  it("keeps the Spanish catalogs complete", () => {
    for (const key of Object.keys(enBillingMessages)) {
      expect(esBillingMessages).toHaveProperty(key);
    }
    for (const key of Object.keys(enInventoryMessages)) {
      expect(esInventoryMessages).toHaveProperty(key);
    }
  });

  it("localizes invoice and stock statuses without changing internal values", () => {
    const en = createTranslator("en");
    const es = createTranslator("es");

    expect(es("billing.paid")).toBe("Pagada");
    expect(es("billing.overdue")).toBe("Vencida");
    expect(es("inventory.inStock")).toBe("En existencia");
    expect(es("inventory.lowStock")).toBe("Existencias bajas");
    expect(en("billing.paid")).toBe("Paid");
    expect(en("inventory.inStock")).toBe("In Stock");
    for (const [key, expectedEs, expectedEn] of [
      ["billing.draft", "Borrador", "Draft"],
      ["billing.sent", "Enviada", "Sent"],
      ["billing.paid", "Pagada", "Paid"],
      ["billing.overdue", "Vencida", "Overdue"],
      ["billing.void", "Anulada", "Void"],
    ] as const) {
      expect(es(key)).toBe(expectedEs);
      expect(en(key)).toBe(expectedEn);
    }
  });

  it("keeps data-oriented labels distinct from persisted names and identifiers", () => {
    const es = createTranslator("es");
    expect(es("billing.client")).toBe("Tutor");
    expect(es("inventory.sku")).toBe("SKU");
    expect(es("inventory.lotNumber")).toBe("Número de lote");
  });

  it("localizes known inventory categories while preserving custom values", () => {
    const en = createTranslator("en");
    const es = createTranslator("es");

    expect(getInventoryCategoryLabel("Medication", es)).toBe("Medicamento");
    expect(getInventoryCategoryLabel("Medication", en)).toBe("Medication");
    expect(getInventoryCategoryLabel("Food", es)).toBe("Alimento");
    expect(getInventoryCategoryLabel("Preventive", es)).toBe("Preventivo");
    expect(getInventoryCategoryLabel("Supply", es)).toBe("Suministro");
    expect(getInventoryCategoryLabel("Supplement", es)).toBe("Suplemento");
    expect(getInventoryCategoryLabel("Custom clinic category", es)).toBe(
      "Custom clinic category",
    );

    const inventory = readFileSync("app/(dashboard)/inventory/page.tsx", "utf8");
    const router = readFileSync("server/routers/inventory.ts", "utf8");

    expect(inventory).toContain("getInventoryCategoryLabel(product.category, t)");
    expect(inventory).toContain("getInventoryCategoryLabel(form.category, t)");
    expect(inventory).toContain("getInventoryCategoryLabel(c.value, t)");
    expect(inventory).toContain("getInventoryCategoryLabel(cat.value, t)");
    expect(router).toMatch(/category:\s*optionalTrimmedString\(/);
    expect(createTranslator("es")("inventory.category")).toBe("Categoría");
  });

  it("formats inventory expiration dates through the active language locale", () => {
    const inventory = readFileSync("app/(dashboard)/inventory/page.tsx", "utf8");
    expect(inventory).toContain('language === "es" ? "es-CR" : "en-US"');
    expect(inventory).toContain("formatClinicalDate(value, \"UTC\", value, locale)");
  });

  it("routes billing and inventory structural copy through the catalogs", () => {
    const billing = readFileSync("app/(dashboard)/billing/page.tsx", "utf8");
    const newInvoice = readFileSync(
      "app/(dashboard)/billing/new/page.tsx",
      "utf8",
    );
    const inventory = readFileSync("app/(dashboard)/inventory/page.tsx", "utf8");

    for (const source of [billing, newInvoice, inventory]) {
      expect(source).not.toMatch(
        /(?:No estimates yet|No invoices yet|No products yet|Unable to load invoices\. Please retry\.|Unable to load inventory products\. Please retry\.|Unable to load inventory suppliers\. Please retry\.|Card payments are not configured|Take card payment|Create draft|Review & create|Open visit|Recently waived|Reopen)/,
      );
    }
    expect(billing).toContain('t("billing.dispenseQueueDescription")');
    expect(billing).toContain('t("billing.typeLabel")');
    expect(billing).toContain('t("billing.notes")');
    expect(newInvoice).toContain('t("billing.removeLineItem")');
    expect(inventory).toContain('t("inventory.noProducts")');
    expect(inventory).toContain('t("inventory.suppliersLoadError")');
  });
});
