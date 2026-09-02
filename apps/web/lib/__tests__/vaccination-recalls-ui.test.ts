import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../../app/(dashboard)/recalls/page.tsx", import.meta.url),
  "utf8"
);
const routerSource = readFileSync(
  new URL("../../server/routers/notifications.ts", import.meta.url),
  "utf8"
);
const serviceSource = readFileSync(
  new URL("../../server/vaccination-recalls.ts", import.meta.url),
  "utf8"
);

describe("vaccination recall operator UI", () => {
  it("shows server-computed eligibility and only selects eligible recipients", () => {
    expect(pageSource).toContain(
      "trpc.notifications.getVaccinationRecallPreview.useQuery"
    );
    expect(pageSource).toContain('recipient.status === "eligible"');
    expect(pageSource).toContain('recipient.channel === "sms"');
    expect(pageSource).toContain("disabled={!eligible || sendReminders.isPending}");
    expect(pageSource).toContain("recipient.blockMessage");
  });

  it("requires an explicit final confirmation for single and batch sends", () => {
    expect(pageSource).toContain("window.confirm(");
    expect(pageSource).toContain('t("recalls.sendSelected")');
    expect(pageSource).toContain("sendPatients([recipient.patientId])");
    expect(pageSource).toContain('t("recalls.description")');
    expect(pageSource).toContain('t("recalls.selectDescription")');
    expect(pageSource).not.toContain("useEffect(");
  });

  it("keeps both UI and backend batches bounded", () => {
    expect(pageSource).toContain("const MAX_BATCH_SIZE = 100");
    expect(pageSource).toContain(".slice(0, MAX_BATCH_SIZE)");
    expect(routerSource).toContain("REMINDER_BATCH_MAX_TARGETS");
    expect(routerSource).toContain(".max(");
  });
});

describe("vaccination recall delivery safety", () => {
  it("uses an atomic communication claim before any provider call", () => {
    const claim = serviceSource.indexOf(".onConflictDoNothing({ target: communications.dedupeKey })");
    const email = serviceSource.indexOf("return await sendVaccinationReminder({");
    const sms = serviceSource.indexOf("const smsResult = await sendVaccinationReminderSms({");
    expect(claim).toBeGreaterThan(0);
    expect(claim).toBeLessThan(email);
    expect(claim).toBeLessThan(sms);
  });

  it("recomputes selected IDs and fails closed for ambiguous location senders", () => {
    expect(serviceSource).toContain(
      "loadVaccinationRecallRecipients(ctx, targets)"
    );
    expect(serviceSource).toContain(".limit(2)");
    expect(serviceSource).toContain(
      "return senders.length === 1 ? senders[0]! : null"
    );
  });

  it("releases the unique claim after a failed provider attempt", () => {
    expect(serviceSource).toContain('status: "failed"');
    expect(serviceSource).toContain("dedupeKey: null");
  });

  it("only exposes recall operations to clinic operations roles", () => {
    const recallRouter = routerSource.slice(
      routerSource.indexOf("getVaccinationRecallPreview:"),
      routerSource.indexOf("}),\n});")
    );
    expect(recallRouter.match(/requireRole\("admin", "veterinarian", "front_desk"\)/g))
      .toHaveLength(2);
  });

  it("has no automatic or cron-triggered send path", () => {
    expect(serviceSource).not.toContain("cron");
    expect(serviceSource).not.toContain("setInterval");
    expect(serviceSource).not.toContain("schedule");
  });
});
