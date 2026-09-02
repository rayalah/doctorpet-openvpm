import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("care reminder safety contract", () => {
  const schema = read("../../packages/db/schema/care-reminders.ts");
  const rls = read("../../packages/db/rls/enable-rls.sql");
  const router = read("server/routers/care-reminders.ts");
  const page = read("app/(dashboard)/care-reminders/page.tsx");

  it("binds reminders, actors, and import identities to one tenant", () => {
    expect(schema).toContain("care_reminders_patient_tenant_fk");
    expect(schema).toContain("care_reminders_creator_tenant_fk");
    expect(schema).toContain("care_reminders_completer_tenant_fk");
    expect(schema).toContain("care_reminders_external_id_uq");
    expect(schema).toContain("care_reminders_import_fingerprint_uq");
    expect(rls).toMatch(/'capture_sessions','care_reminders','cases'/);
  });

  it("keeps completion coherent and never exposes a send mutation", () => {
    expect(schema).toContain("care_reminders_state_check");
    expect(router).toContain("setCompleted");
    expect(router).not.toMatch(/send(?:Email|Sms|Reminder)/);
    expect(page).toContain('t("reminders.description")');
    expect(page).toContain("item.updatedAtVersion");
    expect(page).toContain("reminders.changedError");
    expect(page).not.toContain("toast.error(error.message)");
    expect(router).toContain('code: "CONFLICT"');
    expect(router).toContain("updatedAtVersion");
    expect(router).toContain("::timestamptz");
  });

  it("surfaces the reusable queue in primary navigation", () => {
    expect(read("components/layout/sidebar.tsx")).toContain(
      'href: "/care-reminders"',
    );
    expect(read("components/common/command-search.tsx")).toContain(
      'href: "/care-reminders"',
    );
    expect(read("components/layout/top-bar.tsx")).toContain(
      '"/care-reminders": "navigation.careReminders"',
    );
  });
});
