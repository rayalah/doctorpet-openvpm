"use client";

import { useEffect } from "react";
import { CalendarPlus, UserPlus } from "lucide-react";
import { FirstDayRecommendations } from "@/components/onboarding/first-day-recommendations";
import type { JourneyState, StepHandle } from "../journey-types";
import { useTranslations } from "@/lib/i18n/client";

/**
 * Closing step: turn setup momentum into the first real clinic action. The
 * overlay completes guided setup and routes to the action named here.
 */
export function AllSetStep({
  register,
  state,
}: {
  register: (h: StepHandle) => void;
  state: JourneyState;
}) {
  const t = useTranslations();
  const hasImportedData = state.hasImportedData;
  useEffect(() => {
    register({
      continueLabel: hasImportedData
        ? t("onboarding.allSet.book")
        : t("onboarding.allSet.addClient"),
      onContinue: async () => true,
    });
  }, [hasImportedData, register, t]);

  const Icon = hasImportedData ? CalendarPlus : UserPlus;

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          {hasImportedData
            ? t("onboarding.allSet.imported")
            : t("onboarding.allSet.basics")}
        </p>
      </div>

      <FirstDayRecommendations hasImportedData={hasImportedData} />
    </div>
  );
}
