import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { practices } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  isRegulatoryProfile,
  type RegulatoryProfile,
} from "@/lib/locale/regional-profile";
import {
  regulatoryCapabilitiesForProfile,
  supportsRegulatoryCapability,
  type RegulatoryCapability,
} from "@/lib/regulation/regulatory-capabilities";

type RegulatoryDb = Pick<Database, "select">;

export interface RegulatoryContext {
  db: RegulatoryDb;
  practiceId: string;
}

export async function resolvePracticeRegulatoryProfile(
  ctx: RegulatoryContext,
): Promise<RegulatoryProfile> {
  const [practice] = await ctx.db
    .select({ regulatoryProfile: practices.regulatoryProfile })
    .from(practices)
    .where(and(eq(practices.id, ctx.practiceId), isNull(practices.deletedAt)))
    .limit(1);

  if (!practice) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Practice not found" });
  }

  return isRegulatoryProfile(practice.regulatoryProfile)
    ? practice.regulatoryProfile
    : "UNSPECIFIED";
}

export async function resolvePracticeRegulatoryAccess(ctx: RegulatoryContext) {
  const regulatoryProfile = await resolvePracticeRegulatoryProfile(ctx);
  return {
    regulatoryProfile,
    ...regulatoryCapabilitiesForProfile(regulatoryProfile),
  };
}

export async function assertPracticeRegulatoryCapability(
  ctx: RegulatoryContext,
  capability: RegulatoryCapability,
): Promise<RegulatoryProfile> {
  const profile = await resolvePracticeRegulatoryProfile(ctx);
  if (!supportsRegulatoryCapability(profile, capability)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This practice's regulatory profile does not enable ${capability} features.`,
    });
  }
  return profile;
}
