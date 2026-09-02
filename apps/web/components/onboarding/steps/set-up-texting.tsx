"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Check, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { platformBrand } from "@/lib/brand/platform-brand";
import { platformOperationalConfig } from "@/lib/brand/platform-operational-config";
import { Button } from "@/components/ui/button";
import {
  MessagingWizard,
  type MessagingSetupLocation,
} from "@/components/settings/messaging-wizard";
import type { StepHandle } from "../journey-types";
import { useTranslations } from "@/lib/i18n/client";

/**
 * Optional step: text-enable a phone number so the clinic can send reminders and
 * two-way texts. Reuses the self-contained MessagingWizard (it layers above this
 * overlay), so nothing is lost — Continue always advances (this step is skippable).
 */
export function SetUpTextingStep({
  register,
}: {
  register: (h: StepHandle) => void;
}) {
  const t = useTranslations();
  const status = trpc.messaging.getStatus.useQuery(undefined, { retry: false });
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    // Skippable: Continue never blocks.
    register({ onContinue: async () => true });
  }, [register]);

  // Prefer the primary location; fall back to the first one. Map into the exact
  // MessagingSetupLocation shape (getStatus adds a `provider` field the wizard
  // doesn't take).
  const location: MessagingSetupLocation | null = (() => {
    const locs = status.data?.locations ?? [];
    if (locs.length === 0) return null;
    const l = locs.find((loc) => loc.isPrimary) ?? locs[0]!;
    return {
      locationId: l.locationId,
      name: l.name,
      isPrimary: l.isPrimary,
      existingPhone: l.existingPhone,
      messaging: l.messaging
        ? {
            senderE164: l.messaging.senderE164,
            messagingProfileId: l.messaging.messagingProfileId,
            numberSource: l.messaging.numberSource,
            registrationStatus: l.messaging.registrationStatus ?? "not_started",
            registrationDetail: l.messaging.registrationDetail,
            enabled: l.messaging.enabled ?? false,
            launchEligible: l.messaging.launchEligible,
          }
        : null,
    };
  })();

  const messaging = location?.messaging ?? null;
  const hosted = status.data?.launch.hosted ?? false;
  const setupAvailable = status.data?.launch.setupAvailable;
  const setupCapabilityKnown = Boolean(status.data);
  const hasAnyNumber = Boolean(
    status.data?.locations.some(
      (loc) =>
        loc.messaging?.senderE164?.trim() &&
        loc.messaging.registrationStatus !== "failed",
    ),
  );
  const setupDisabled = setupAvailable === false;
  const setupUnavailable = setupAvailable === false && !hasAnyNumber;
  const hasSender = Boolean(
    messaging?.senderE164?.trim() && messaging?.messagingProfileId?.trim(),
  );
  const isFailed = messaging?.registrationStatus === "failed";
  const isConfigured = hasSender && !isFailed;
  const isActive =
    messaging?.registrationStatus === "active" &&
    !!messaging?.enabled &&
    messaging.launchEligible !== false;
  const statusDetail = (() => {
    if (!messaging) return null;
    if (isFailed) {
      return t("messaging.onboardingNumberSetupFailed");
    }
    if (messaging.registrationStatus === "not_started" && hasSender) {
      return t("messaging.onboardingNumberAccepted");
    }
    if (messaging.registrationStatus === "pending") {
      return t("messaging.onboardingRegistrationPending");
    }
    if (messaging.registrationStatus === "active" && !messaging.enabled) {
      return t("messaging.onboardingRegistrationApproved");
    }
    if (
      messaging.registrationStatus === "active" &&
      messaging.enabled &&
      messaging.launchEligible === false
    ) {
      return hosted
        ? t("messaging.onboardingPilotApprovalPending")
        : t("messaging.onboardingAdminApprovalPending");
    }
    if (isActive) return t("messaging.onboardingActive");
    if (messaging.registrationStatus === "action_required") {
      return t("messaging.onboardingActionRequired");
    }
    if (messaging.registrationStatus === "suspended") {
      return hosted
        ? t("messaging.onboardingSuspendedHosted")
        : t("messaging.onboardingSuspendedAdmin");
    }
    return t("messaging.onboardingNotReady");
  })();

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        {!setupCapabilityKnown ? (
          t("messaging.onboardingOptional")
        ) : setupDisabled ? (
          hosted ? (
            <>
              {hasAnyNumber
                ? `${t("messaging.onboardingExistingReview")} `
                : `${t("messaging.onboardingPilotUnavailable")} `}
              {t("messaging.onboardingEmailAvailable")} {t("messaging.onboardingReview")} {" "}
              <Link
                href="/settings?tab=messaging"
                className="font-medium text-emerald-700 underline underline-offset-2"
              >
                {t("messaging.onboardingMessagingSettings")}
              </Link>{" "}
              {t("messaging.onboardingOr")}{" "}
              {platformOperationalConfig.supportEmail ? (
                <a
                  href={`mailto:${platformOperationalConfig.supportEmail}?subject=${encodeURIComponent(`${platformBrand.productName} texting pilot`)}`}
                  className="font-medium text-emerald-700 underline underline-offset-2"
                >
                  {t("messaging.onboardingContactSupport").replace(
                    "{product}",
                    platformBrand.productName,
                  )}
                </a>
              ) : (
                t("messaging.onboardingContactRepresentative")
              )}{" "}
              {hasAnyNumber
                ? ` ${t("messaging.onboardingExistingHelp")}`
                : ` ${t("messaging.onboardingPilotReady")}`}
            </>
          ) : (
            t("messaging.onboardingDisabledDeployment")
          )
        ) : (
          t("messaging.onboardingInvite").replace(
            "{product}",
            platformBrand.productName,
          )
        )}
      </p>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            {status.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("messaging.checkingSms")}…
              </p>
            ) : status.error ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {t("messaging.unableToCheckSms")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("messaging.retrySmsStatus")}
                </p>
              </div>
            ) : setupUnavailable ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {hosted
                    ? t("messaging.onboardingPilotTitle")
                    : t("messaging.onboardingSetupDisabled")}
                </p>
                <p className="text-xs text-slate-500">
                  {hosted
                    ? t("messaging.onboardingPilotDescription")
                    : t("messaging.onboardingAdminDescription")}
                </p>
              </div>
            ) : setupDisabled && !messaging ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {t("messaging.onboardingNewNumberUnavailable")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("messaging.onboardingExistingSetupDescription")}
                </p>
              </div>
            ) : messaging ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {messaging.senderE164 ?? t("messaging.textingSetupNeedsAttention")}
                </p>
                <p className="text-xs text-slate-500">{statusDetail}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {t("messaging.onboardingNotSetUp")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("messaging.onboardingSetUpFor").replace(
                    "{clinic}",
                    location?.name ?? t("messaging.yourClinic"),
                  )}
                </p>
              </div>
            )}
          </div>
          {!status.isLoading && !status.error && location ? (
            setupAvailable === false || messaging ? (
              <Button asChild type="button" variant="outline" size="sm">
                <Link href="/settings?tab=messaging">
                  {isConfigured ? <Check className="mr-1.5 h-4 w-4" /> : null}
                  {t("messaging.onboardingMessagingSettings")}
                </Link>
              </Button>
            ) : setupAvailable ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setWizardOpen(true)}
              >
                {t("messaging.onboardingSetUp")}
              </Button>
            ) : null
          ) : null}
        </div>
      </div>

      {setupAvailable ? (
        <MessagingWizard
          location={location}
          hosted={hosted}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onChanged={() => void status.refetch()}
        />
      ) : null}
    </div>
  );
}
