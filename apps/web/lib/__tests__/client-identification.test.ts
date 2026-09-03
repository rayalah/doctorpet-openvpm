import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ClientIdentificationFields } from "@/components/clients/identification-fields";
import { I18nProvider } from "@/lib/i18n/client";
import { createTranslator } from "@/lib/i18n/messages";
import { CLIENT_IDENTIFICATION_MAX_LENGTH, isOptionalClientTextValid } from "../clients/policy";
import { toApiClient } from "../compat/openvpm/mappers";
import { clientRow } from "../compat/openvpm/__tests__/fixtures";

describe("client identification and privacy presentation", () => {
  it.each(["es", "en"] as const)("renders optional accessible identification and approved privacy copy in %s", (language) => {
    const t = createTranslator(language);
    const html = renderToStaticMarkup(
      React.createElement(I18nProvider, {
        language,
        children: React.createElement(ClientIdentificationFields, {
          value: "001-AB", onChange: () => undefined,
        }),
      }),
    );
    expect(html).toContain(t("clients.identification"));
    expect(html).toContain(t("clients.privacyNotice"));
    expect(html).toContain(t("clients.identificationHelp"));
    expect(html).toContain('for="identification"');
    expect(html).toContain('aria-describedby="identification-help"');
    expect(html).toContain('id="identification-help"');
    expect(html).toContain('value="001-AB"');
    expect(html).toContain('type="text"');
    expect(html).toContain('maxLength="128"');
    expect(html).not.toContain("required=");
  });

  it("retains the approved Spanish notice and English fallback", () => {
    expect(createTranslator("es")("clients.privacyNotice")).toBe(
      "Privacidad de sus datos: La información suministrada es confidencial y será utilizada únicamente para las finalidades necesarias para la prestación y gestión de los servicios de la clínica mediante Doctor Pet App. Sus datos no serán vendidos ni comercializados con terceros.",
    );
    expect(createTranslator("es")("clients.identification")).toBe("Cédula / identificación");
    expect(createTranslator("en")("clients.identification")).toBe("ID / identification");
    const fallback = renderToStaticMarkup(React.createElement(I18nProvider, {
      language: "unsupported",
      children: React.createElement(ClientIdentificationFields, {
        value: "", onChange: () => undefined,
      }),
    }));
    expect(fallback).toContain(createTranslator("en")("clients.privacyNotice"));
  });

  it("connects create/edit to the shared optional control and displays identification only when present", () => {
    for (const path of ["app/(dashboard)/clients/new/page.tsx", "app/(dashboard)/clients/[id]/edit/page.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("<ClientIdentificationFields");
      expect(source).toContain("value={form.identification}");
      expect(source).toContain('onChange={(value) => updateField("identification", value)}');
      expect(source).toContain("identification: form.identification.trim() || null");
      expect(source).toContain("isOptionalClientTextValid(form.identification, CLIENT_IDENTIFICATION_MAX_LENGTH)");
    }
    expect(readFileSync("app/(dashboard)/clients/[id]/edit/page.tsx", "utf8"))
      .toContain('identification: client.identification ?? ""');
    expect(readFileSync("app/(dashboard)/clients/[id]/edit/page.tsx", "utf8"))
      .toContain("await utils.clients.getById.invalidate({ id: params.id })");
    const detail = readFileSync("app/(dashboard)/clients/[id]/page.tsx", "utf8");
    expect(detail).toContain("{client.identification && (");
    expect(detail).toContain('{t("clients.identification")}: {client.identification}');
  });

  it("keeps the public v1 API unchanged without exposing identification", () => {
    const legacy = toApiClient(clientRow());
    const withId = toApiClient(clientRow({ identification: "PASSPORT 001" }));
    expect(withId).toEqual(legacy);
    expect(withId).not.toHaveProperty("identification");
  });

  it("accepts optional international text without numeric coercion", () => {
    for (const value of ["", "001-0001-0002", "DIMEX 001234567890", "PASSPORT AB-001", "x".repeat(128)]) {
      expect(isOptionalClientTextValid(value, CLIENT_IDENTIFICATION_MAX_LENGTH)).toBe(true);
    }
    expect(isOptionalClientTextValid("x".repeat(129), CLIENT_IDENTIFICATION_MAX_LENGTH)).toBe(false);
  });

  it("adds only a nullable column without backfill, uniqueness, or changes to existing rows", () => {
    const sql = readFileSync("../../packages/db/drizzle/0097_client_identification.sql", "utf8");
    expect(sql.trim()).toBe('ALTER TABLE "clients" ADD COLUMN "identification" varchar(128);');
    const before = JSON.parse(readFileSync("../../packages/db/drizzle/meta/0096_snapshot.json", "utf8"));
    const after = JSON.parse(readFileSync("../../packages/db/drizzle/meta/0097_snapshot.json", "utf8"));
    expect(after.tables["public.clients"].columns.identification).toMatchObject({
      name: "identification", type: "varchar(128)", notNull: false, primaryKey: false,
    });
    delete after.tables["public.clients"].columns.identification;
    expect(after.tables).toEqual(before.tables);
  });
});
