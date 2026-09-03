"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import type { StepHandle } from "../journey-types";
import { useTranslations } from "@/lib/i18n/client";

/**
 * Optional step: add a card to lock in the plan. Never forced — Continue always
 * skips. "Add a card" opens Stripe Checkout (off-site); before redirecting we
 * advance the durable journey cursor to the closing step, so when Stripe returns
 * to the app the wizard resumes at "You're all set" rather than back here.
 */
export function AddACardStep({
  register,
}: {
  register: (h: StepHandle) => void;
}) {
  const t = useTranslations();
  const subscription = trpc.subscription.get.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    // Skippable: Continue never blocks.
    register({ onContinue: async () => true });
  }, [register]);

  const unitPrice = subscription.data?.locationUnitPriceMonthlyUsd ?? 79;
  const annualPrice = subscription.data?.annualLocationUnitPriceUsd ?? 790;
  const alreadyHasCard = Boolean(
    subscription.data?.hasSubscription || subscription.data?.hasBillingAccount,
  );

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        {t("onboarding.card.optional")}
      </p>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm text-slate-600">Doctor Pet</span>
          <div className="text-right">
            <p className="font-heading text-lg font-bold text-slate-900">
              ${unitPrice}
              <span className="text-sm font-normal text-slate-500">
                {t("onboarding.card.month")}
              </span>
            </p>
            <p className="text-sm font-medium text-emerald-700">
              {t("onboarding.card.or")} ${annualPrice}
              {t("onboarding.card.year")}
            </p>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t("onboarding.card.included")}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        {t("onboarding.card.secure")}
      </div>

      {alreadyHasCard ? (
        <p className="text-sm font-medium text-emerald-700">
          {t("onboarding.card.saved")}
        </p>
      ) : (
        <Button asChild type="button" variant="outline">
          <Link href="/settings?tab=billing">
            <CreditCard className="mr-2 h-4 w-4" />
            {t("onboarding.card.choose")}
          </Link>
        </Button>
      )}
    </div>
  );
}
