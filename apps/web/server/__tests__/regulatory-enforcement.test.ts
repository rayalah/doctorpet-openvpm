import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assertPracticeRegulatoryCapability,
  resolvePracticeRegulatoryProfile,
} from "../regulatory-enforcement";

const PRACTICE_ID = "00000000-0000-0000-0000-0000000000aa";

function dbForProfile(regulatoryProfile: string | null, exists = true) {
  const limit = vi.fn(async () => (exists ? [{ regulatoryProfile }] : []));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select }, select };
}

describe("server regulatory enforcement", () => {
  it("rejects both foreign capability gates for CR_NEUTRAL", async () => {
    const dea = dbForProfile("CR_NEUTRAL");
    await expect(
      assertPracticeRegulatoryCapability(
        { db: dea.db as never, practiceId: PRACTICE_ID },
        "US_DEA",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const vmd = dbForProfile("CR_NEUTRAL");
    await expect(
      assertPracticeRegulatoryCapability(
        { db: vmd.db as never, practiceId: PRACTICE_ID },
        "UK_VMD",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows only the capability belonging to each explicit legacy profile", async () => {
    await expect(
      assertPracticeRegulatoryCapability(
        { db: dbForProfile("US_DEA").db as never, practiceId: PRACTICE_ID },
        "US_DEA",
      ),
    ).resolves.toBe("US_DEA");
    await expect(
      assertPracticeRegulatoryCapability(
        { db: dbForProfile("UK_VMD").db as never, practiceId: PRACTICE_ID },
        "UK_VMD",
      ),
    ).resolves.toBe("UK_VMD");
  });

  it("treats missing or invalid persisted values conservatively", async () => {
    await expect(
      resolvePracticeRegulatoryProfile({
        db: dbForProfile(null).db as never,
        practiceId: PRACTICE_ID,
      }),
    ).resolves.toBe("UNSPECIFIED");
    await expect(
      resolvePracticeRegulatoryProfile({
        db: dbForProfile("unexpected").db as never,
        practiceId: PRACTICE_ID,
      }),
    ).resolves.toBe("UNSPECIFIED");
  });

  it("resolves the profile only from the authenticated practice scope", () => {
    const source = readFileSync(
      new URL("../regulatory-enforcement.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("eq(practices.id, ctx.practiceId)");
    expect(source).toContain("isNull(practices.deletedAt)");
    expect(source).not.toContain("input.regulatoryProfile");
  });
});
