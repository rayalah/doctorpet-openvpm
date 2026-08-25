import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { practices } from "@openpims/db";

const migration = readFileSync(
  new URL(
    "../../../../packages/db/drizzle/0096_practice_regional_profile_persistence.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("practice regional profile persistence", () => {
  it("declares the independent regional fields on the tenant root table", () => {
    const columns = new Map(
      getTableConfig(practices).columns.map((column) => [column.name, column]),
    );

    expect(columns.get("language")?.notNull).toBe(true);
    expect(columns.get("format_locale")?.notNull).toBe(true);
    expect(columns.get("regulatory_profile")?.notNull).toBe(true);
    expect(columns.get("fiscal_provider")?.notNull).toBe(true);
  });

  it("backfills legacy rows explicitly and never maps unknown countries to US_DEA", () => {
    expect(migration).toContain('UPDATE "practices"');
    expect(migration).toContain("WHEN 'GB' THEN 'UK_VMD'");
    expect(migration).toContain("WHEN 'CR' THEN 'CR_NEUTRAL'");
    expect(migration).toContain("ELSE 'UNSPECIFIED'");
    expect(migration).toContain('"fiscal_provider" = \'none\'');
    expect(migration).not.toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toContain("CREATE POLICY");
  });
});
