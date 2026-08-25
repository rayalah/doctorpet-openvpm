import { and, eq, isNull } from "drizzle-orm";
import { practiceConversionMilestones, practices } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  billingEnforced,
  hasHostedFullAccess,
  isTrialActive,
} from "@/lib/billing/plans";

export const AI_TRIAL_BILLING_SETUP_MESSAGE =
  "Add a card to your trial to try Doctor Pet AI. The rest of your free trial stays available, and adding a card does not end it.";

export const AI_SUBSCRIPTION_INACTIVE_MESSAGE =
  "Doctor Pet AI is available when your trial or subscription is active.";

export type HostedAiAccessReason =
  | "allowed"
  | "billing_setup_required"
  | "subscription_inactive";

export interface HostedAiAccessDecision {
  allowed: boolean;
  reason: HostedAiAccessReason;
  message: string | null;
}

export interface HostedAiPracticeState {
  tier: string | null;
  billingStatus: string | null;
  trialEndsAt: Date | string | null;
  stripeSubscriptionId: string | null;
  billingSetupRecorded: boolean;
}

export function hostedAiAccessDecision(
  practice: HostedAiPracticeState,
  options?: { enforced?: boolean; now?: Date },
): HostedAiAccessDecision {
  const enforced = options?.enforced ?? billingEnforced();
  const now = options?.now ?? new Date();

  if (!enforced) {
    return { allowed: true, reason: "allowed", message: null };
  }

  if (
    !hasHostedFullAccess(
      practice.tier,
      practice.billingStatus,
      practice.trialEndsAt,
      now,
      true,
    )
  ) {
    return {
      allowed: false,
      reason: "subscription_inactive",
      message: AI_SUBSCRIPTION_INACTIVE_MESSAGE,
    };
  }

  if (
    isTrialActive(practice.billingStatus, practice.trialEndsAt, now) &&
    (!practice.stripeSubscriptionId || !practice.billingSetupRecorded)
  ) {
    return {
      allowed: false,
      reason: "billing_setup_required",
      message: AI_TRIAL_BILLING_SETUP_MESSAGE,
    };
  }

  return { allowed: true, reason: "allowed", message: null };
}

/**
 * Read the exact server-owned facts used for hosted AI access. The billing
 * setup signal is projected only from a verified Stripe Checkout webhook;
 * a Stripe customer id or a client-provided flag is never sufficient.
 */
export async function readHostedAiAccess(
  db: Database,
  practiceId: string,
  options?: { enforced?: boolean; now?: Date },
): Promise<HostedAiAccessDecision | null> {
  const enforced = options?.enforced ?? billingEnforced();
  if (!enforced) {
    return { allowed: true, reason: "allowed", message: null };
  }

  const [practice] = await db
    .select({
      tier: practices.subscriptionTier,
      billingStatus: practices.billingStatus,
      trialEndsAt: practices.trialEndsAt,
      stripeSubscriptionId: practices.stripeSubscriptionId,
      billingSetupOccurredAt: practiceConversionMilestones.occurredAt,
    })
    .from(practices)
    .leftJoin(
      practiceConversionMilestones,
      and(
        eq(practiceConversionMilestones.practiceId, practices.id),
        eq(practiceConversionMilestones.milestone, "payment_method_collected"),
        eq(practiceConversionMilestones.evidenceSource, "stripe_webhook"),
      ),
    )
    .where(and(eq(practices.id, practiceId), isNull(practices.deletedAt)))
    .limit(1);

  if (!practice) return null;

  return hostedAiAccessDecision(
    {
      tier: practice.tier,
      billingStatus: practice.billingStatus,
      trialEndsAt: practice.trialEndsAt,
      stripeSubscriptionId: practice.stripeSubscriptionId,
      billingSetupRecorded: Boolean(practice.billingSetupOccurredAt),
    },
    { enforced: true, now: options?.now },
  );
}
