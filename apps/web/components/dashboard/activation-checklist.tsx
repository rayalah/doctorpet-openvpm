"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Headphones,
  Loader2,
  PartyPopper,
  Sparkles,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTour } from "@/components/tour/tour-provider";
import { useOnboardingJourney } from "@/components/onboarding/journey-overlay";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n/messages";
import {
  DEFAULT_ONBOARDING_INTENT,
  getOnboardingIntentOption,
} from "@/lib/onboarding/intent";

type Milestone = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

const JOURNEY_STEP_LABEL_KEYS: Record<string, TranslationKey> = {
  intent: "activation.step.intent",
  basics: "activation.step.basics",
  branding: "activation.step.branding",
  team: "activation.step.team",
  data: "activation.step.data",
  agent: "activation.step.agent",
  phone: "activation.step.phone",
  billing: "activation.step.billing",
  allSet: "activation.step.allSet",
};

const PATH_TRANSLATION_KEYS = {
  alongside: {
    short: "activation.path.alongside.short",
    firstWin: "activation.path.alongside.firstWin",
    firstWinHint: "activation.path.alongside.firstWinHint",
  },
  replace: {
    short: "activation.path.replace.short",
    firstWin: "activation.path.replace.firstWin",
    firstWinHint: "activation.path.replace.firstWinHint",
  },
  explore: {
    short: "activation.path.explore.short",
    firstWin: "activation.path.explore.firstWin",
    firstWinHint: "activation.path.explore.firstWinHint",
  },
  self_host: {
    short: "activation.path.self_host.short",
    firstWin: "activation.path.self_host.firstWin",
    firstWinHint: "activation.path.self_host.firstWinHint",
  },
} as const;

/**
 * Persistent activation checklist shown on the dashboard through the whole
 * trial. Unlike the old finish-setup card (which only appeared after onboarding
 * "completed" and tracked setup chores), this is value-milestone based and is
 * derived entirely from real practice state — giving a new admin momentum and a
 * concrete reason to come back, all the way to confirming billing is connected.
 */
export function ActivationChecklist() {
  const t = useTranslations();
  const { start } = useTour();
  const { openJourney } = useOnboardingJourney();
  const [hidden, setHidden] = useState(false);
  const { data: session, status } = useSession();
  const isAdmin = status === "authenticated" && session?.user?.role === "admin";

  // No long staleTime: each dashboard mount re-checks, so operational progress
  // such as publishing booking or completing a visit shows as done immediately.
  const opts = {
    enabled: isAdmin,
    retry: false,
    refetchOnWindowFocus: false,
  } as const;
  const state = trpc.settings.getOnboardingState.useQuery(undefined, opts);
  const onboarding = trpc.settings.onboardingStatus.useQuery(undefined, opts);
  const practice = trpc.settings.getPractice.useQuery(undefined, opts);
  const sub = trpc.subscription.get.useQuery(undefined, opts);
  const texting = trpc.messaging.activationSummary.useQuery(undefined, opts);
  const booking = trpc.booking.getMyPage.useQuery(undefined, opts);
  const clientPayments = trpc.billing.paymentAccountStatus.useQuery(
    undefined,
    opts,
  );
  const dismiss = trpc.settings.dismissSetup.useMutation();
  const utils = trpc.useUtils();
  const requestSetupHelp = trpc.settings.requestOnboardingHelp.useMutation({
    onSuccess: async () => {
      await utils.settings.getOnboardingState.invalidate();
      toast.success(t("activation.setupRequestReceived"));
    },
    onError: (error) => toast.error(error.message),
  });

  if (!isAdmin) return null;

  const loadError =
    state.error ??
    onboarding.error ??
    practice.error ??
    sub.error ??
    texting.error ??
    booking.error ??
    clientPayments.error;
  if (loadError) {
    return (
      <ActivationChecklistError
        message={loadError.message}
        onRetry={() => {
          void Promise.all([
            state.refetch(),
            onboarding.refetch(),
            practice.refetch(),
            sub.refetch(),
            texting.refetch(),
            booking.refetch(),
            clientPayments.refetch(),
          ]);
        }}
      />
    );
  }

  const isChecklistLoading =
    state.isLoading ||
    onboarding.isLoading ||
    practice.isLoading ||
    sub.isLoading ||
    texting.isLoading ||
    booking.isLoading ||
    clientPayments.isLoading;

  // Wait for the core signals before rendering so we never flash a wrong state.
  if (isChecklistLoading) return <ActivationChecklistLoading />;
  if (
    !state.data ||
    !onboarding.data ||
    !practice.data ||
    !sub.data ||
    !texting.data ||
    !booking.data ||
    !clientPayments.data
  ) {
    return (
      <ActivationChecklistError
        message={t("activation.dataUnavailable")}
        onRetry={() => {
          void Promise.all([
            state.refetch(),
            onboarding.refetch(),
            practice.refetch(),
            sub.refetch(),
            texting.refetch(),
            booking.refetch(),
            clientPayments.refetch(),
          ]);
        }}
      />
    );
  }
  if (hidden || state.data.setupDismissed) return null;

  const checklistState = state.data;
  const onboardingData = onboarding.data;
  const practiceData = practice.data;
  const subscriptionData = sub.data;
  const textingData = texting.data;
  const bookingData = booking.data;
  const clientPaymentData = clientPayments.data;

  const enforced = subscriptionData.billingEnforced;
  const tourDone =
    checklistState.tourStatus === "completed" ||
    checklistState.tourStatus === "skipped";
  const brandColor = (practiceData.settings as { brandColor?: string } | null)
    ?.brandColor;
  const practiceName = practiceData.name ?? t("activation.practiceFallback");
  const pathway = getOnboardingIntentOption(
    checklistState.onboardingIntent ?? DEFAULT_ONBOARDING_INTENT,
  );
  const includeTextingMilestone =
    textingData.setupAvailable || textingData.hasAnyNumber;

  const explorationMilestones: Milestone[] = [
    {
      key: "tour",
      label: t("activation.tour.label"),
      hint: t("activation.tour.hint"),
      done: tourDone,
      onClick: () => start(),
    },
    {
      key: "brand",
      label: t("activation.brand.label"),
      hint: t("activation.brand.hint"),
      done: !!practiceData.logoUrl || !!brandColor,
      href: "/settings?tab=practice",
    },
    {
      key: "team",
      label: t("activation.team.label"),
      hint: t("activation.team.hint"),
      done: (subscriptionData.billableSeatCount ?? 1) > 1,
      href: "/settings?tab=staff",
    },
    {
      key: "ai",
      label: t("activation.ai.label"),
      hint: t("activation.ai.hint"),
      done: (subscriptionData.usage?.aiRuns ?? 0) > 0,
      href: "/agent",
    },
  ];

  const goLiveMilestones: Milestone[] = [
    {
      key: "data",
      label: t("activation.data.label"),
      hint: t("activation.data.hint"),
      done: onboardingData.hasRealData,
      href: "/clients/new",
    },
    {
      key: "firstAppointment",
      label: t("activation.firstAppointment.label"),
      hint: t("activation.firstAppointment.hint"),
      done: onboardingData.hasRealAppointment,
      href: "/schedule",
    },
    {
      key: "firstVisit",
      label: t("activation.firstVisit.label"),
      hint: t("activation.firstVisit.hint"),
      done: onboardingData.hasCompletedRealVisit,
      href: onboardingData.nextRealAppointmentId
        ? `/encounters/${onboardingData.nextRealAppointmentId}`
        : "/schedule",
    },
    {
      key: "team",
      label: t("activation.team.label"),
      hint: t("activation.teamHandoff.hint"),
      done: (subscriptionData.billableSeatCount ?? 1) > 1,
      href: "/settings?tab=staff",
    },
    {
      key: "booking",
      label: t("activation.booking.label"),
      hint: t("activation.booking.hint"),
      done:
        bookingData.page?.published === true &&
        bookingData.page.config.bookableTypeIds.length > 0,
      href: "/settings?tab=booking",
    },
    ...(includeTextingMilestone
      ? [
          {
            key: "texting",
            label: t("activation.texting.label"),
            hint: t("activation.texting.hint"),
            done: textingData.hasActiveNumber,
            href: "/settings?tab=messaging&setup=texting",
          } as Milestone,
        ]
      : []),
    ...(clientPaymentData.stripeConfigured
      ? [
          {
            key: "clientPayments",
            label: t("activation.payments.label"),
            hint: t("activation.payments.hint"),
            done: clientPaymentData.enabled,
            href: "/settings?tab=billing",
          } as Milestone,
        ]
      : []),
    ...(enforced
      ? [
          {
            key: "billing",
            label: t("activation.billing.label"),
            hint: t("activation.billing.hint"),
            done: !!subscriptionData.hasBillingAccount,
            href: "/settings?tab=billing",
          } as Milestone,
        ]
      : []),
  ];

  // Evaluation remains deliberately light. Clinics running alongside or
  // replacing another PIMS see only the operational go-live path; setup chores
  // such as branding and trying AI stay in the guided tour instead of diluting
  // the activation checklist.
  const standardMilestones =
    pathway.value === "explore"
      ? [
          ...explorationMilestones,
          goLiveMilestones.find((milestone) => milestone.key === "data")!,
        ]
      : pathway.value === "self_host"
        ? [
            explorationMilestones.find(
              (milestone) => milestone.key === "brand",
            )!,
            goLiveMilestones.find((milestone) => milestone.key === "data")!,
            goLiveMilestones.find((milestone) => milestone.key === "team")!,
            goLiveMilestones.find(
              (milestone) => milestone.key === "firstAppointment",
            )!,
            goLiveMilestones.find(
              (milestone) => milestone.key === "firstVisit",
            )!,
          ]
        : goLiveMilestones;
  const firstWinBase =
    standardMilestones.find(
      (milestone) => milestone.key === pathway.firstWinTarget,
    ) ?? standardMilestones[0]!;
  const firstWin: Milestone = {
    ...firstWinBase,
    label: t(PATH_TRANSLATION_KEYS[pathway.value].firstWin),
    hint: t(PATH_TRANSLATION_KEYS[pathway.value].firstWinHint),
  };
  const milestones = [
    firstWin,
    ...standardMilestones.filter((milestone) => milestone.key !== firstWin.key),
  ];

  const total = milestones.length;
  const doneCount = milestones.filter((m) => m.done).length;
  const pct = total === 0 ? 100 : (doneCount / total) * 100;
  const allDone = doneCount === total;
  const setupHelpRequestedAt = checklistState.setupHelpRequestedAt ?? null;
  const guidedSetupIncomplete = onboardingData.completedAt == null;
  const guidedSetupStarted = Boolean(
    checklistState.onboardingIntentSelectedAt || checklistState.journeyStepId,
  );
  const guidedSetupStage = checklistState.journeyStepId
    ? t(JOURNEY_STEP_LABEL_KEYS[checklistState.journeyStepId] ?? "activation.step.intent")
    : null;

  // The corner X just hides the checklist for this session — it comes back next
  // visit ("show later"). "Don't show this again" dismisses it for good.
  function snooze() {
    setHidden(true);
  }
  function dontShowAgain() {
    setHidden(true);
    dismiss.mutate();
  }

  if (allDone && !guidedSetupIncomplete) {
    return (
      <div className="relative z-20 w-full sm:fixed sm:bottom-4 sm:right-4 sm:z-[70] sm:w-[340px]">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-50 shadow-2xl shadow-black/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950">
            <PartyPopper className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-semibold">
               {t("activation.complete.title")}
            </p>
            <p className="text-xs text-zinc-400">
               {t("activation.complete.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={dontShowAgain}
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100"
          >
             {t("activation.dismiss")}
          </button>
        </div>
      </div>
    );
  }

  // Docked launcher: a compact dark card pinned bottom-right, out of the way
  // of the day's real work but always one glance from the next setup win.
  return (
    <div className="relative z-20 w-full sm:fixed sm:bottom-4 sm:right-4 sm:z-[70] sm:w-[340px]">
      <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-50 shadow-2xl shadow-black/30">
        <button
          type="button"
          onClick={snooze}
          aria-label={t("activation.hideForNow")}
          title={t("activation.hideForNow")}
          className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 pr-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">
               {t("activation.finishPrefix")} {practiceName}{t("activation.finishSuffix")}
            </p>
            <p className="text-xs text-zinc-400">
               {t(PATH_TRANSLATION_KEYS[pathway.value].short)} · {doneCount} {t("activation.of")} {total} {t("activation.done")}
            </p>
          </div>
        </div>

        <Progress
          value={pct}
          className="mt-3 h-1.5 bg-zinc-800 [&>div]:bg-emerald-500"
        />

        {guidedSetupIncomplete ? (
          <button
            type="button"
            onClick={openJourney}
            className="mt-3 flex w-full items-center gap-3 rounded-xl bg-emerald-500 px-3 py-2.5 text-left text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {guidedSetupStarted
                  ? t("activation.resume")
                  : t("activation.start")}
              </span>
              <span className="block truncate text-xs text-emerald-950/75">
                {guidedSetupStage
                  ? `${t("activation.continueAt")} ${guidedSetupStage}`
                  : t("activation.choosePath")}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        ) : null}

        <div className="mt-3 max-h-[45vh] space-y-1 overflow-y-auto">
          {milestones.map((m) => {
            const inner = (
              <div
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors",
                  m.done ? "opacity-60" : "hover:bg-zinc-800",
                )}
                title={m.hint}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    m.done
                      ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                      : "border-zinc-600 text-transparent group-hover:border-emerald-400",
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
                <p
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] font-medium",
                    m.done && "text-zinc-400 line-through",
                  )}
                >
                  {m.label}
                </p>
                {!m.done ? (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
                ) : null}
              </div>
            );

            if (m.href) {
              return (
                <Link key={m.key} href={m.href} className="block">
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={m.key}
                type="button"
                onClick={m.onClick}
                className="block w-full text-left"
              >
                {inner}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-zinc-800 pt-2.5">
          {setupHelpRequestedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {t("activation.helpRequested")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => requestSetupHelp.mutate()}
              disabled={requestSetupHelp.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {requestSetupHelp.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Headphones className="h-3.5 w-3.5" />
              )}
              {t("activation.help")}
            </button>
          )}
          <button
            type="button"
            onClick={dontShowAgain}
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {t("activation.dontShowAgain")}
          </button>
        </div>
      </div>
    </div>
  );
}
function ActivationChecklistLoading() {
  // The docked card simply appears once its data is ready; a floating
  // skeleton in the corner would only draw the eye to nothing.
  return null;
}

function ActivationChecklistError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="relative z-20 w-full sm:fixed sm:bottom-4 sm:right-4 sm:z-[70] sm:w-[340px]">
      <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-50 shadow-2xl shadow-black/30">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
             {t("activation.loadError")}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800"
          >
             {t("activation.retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}
