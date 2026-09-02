"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageSquare,
  Phone,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  defaultMessagingSetupMode,
  type MessagingSetupMode,
} from "@/lib/messaging/setup-wizard";
import {
  isMessagingAreaCodeInputValid,
  MESSAGING_AREA_CODE_LENGTH,
} from "@/lib/messaging/policy";
import { toast } from "sonner";
import { useLanguage, useTranslations } from "@/lib/i18n/client";
import { dateLocaleForLanguage } from "@/lib/i18n/language";

export type MessagingSetupLocation = {
  locationId: string;
  name: string;
  isPrimary: boolean;
  existingPhone: string | null;
  messaging: {
    senderE164: string | null;
    messagingProfileId: string | null;
    numberSource: "hosted" | "purchased" | "toll_free" | null;
    registrationStatus:
      | "not_started"
      | "pending"
      | "active"
      | "action_required"
      | "failed"
      | "suspended";
    registrationDetail: string | null;
    providerProfileReady?: boolean;
    providerProfileSyncedAt?: Date | string | null;
    providerProfileAttestationFresh?: boolean;
    enabled: boolean;
    launchEligible?: boolean;
  } | null;
};

type Step = "choose" | "confirm" | "registration" | "done";
type SearchNumber = {
  phoneNumber: string;
  upfrontCost: string;
  monthlyCost: string;
  currency: string;
};

/** Format a provider's raw cost (e.g. "1.00000") using its quoted currency. */
function formatCost(cost: string, currency: string, locale = "en-US"): string {
  const value = Number(cost);
  if (!Number.isFinite(value)) return `${cost} ${currency}`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

const STEP_IDS: Step[] = ["choose", "confirm", "registration", "done"];

function stepTitle(step: Step, t: ReturnType<typeof useTranslations>): string {
  return t(
    step === "choose"
      ? "messaging.chooseNumber"
      : step === "confirm"
        ? "messaging.confirmNumber"
        : step === "registration"
          ? "messaging.reviewPurchase"
          : "messaging.numberOrdered",
  );
}

export function MessagingWizard({
  location,
  hosted,
  open,
  onOpenChange,
  onChanged,
}: {
  location: MessagingSetupLocation | null;
  hosted: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const defaultMode = useMemo(
    () => defaultMessagingSetupMode(location?.existingPhone),
    [location?.existingPhone],
  );
  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<MessagingSetupMode>(defaultMode);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    detail?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [numbers, setNumbers] = useState<SearchNumber[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<SearchNumber | null>(
    null,
  );
  const [provisionedSender, setProvisionedSender] = useState<string | null>(
    null,
  );
  const [chargeAcknowledged, setChargeAcknowledged] = useState(false);

  useEffect(() => {
    if (!open || !location) return;
    setStep("choose");
    setMode(defaultMessagingSetupMode(location.existingPhone));
    setEligibility(null);
    setChecking(false);
    setAreaCode("");
    setNumbers([]);
    setHasSearched(false);
    setSelectedNumber(null);
    setProvisionedSender(null);
    setChargeAcknowledged(false);
  }, [open, location]);

  const provision = trpc.messaging.provisionNumber.useMutation({
    onSuccess: (result) => {
      setProvisionedSender(result.senderE164);
      setStep("done");
      toast.success(
        t("messaging.numberOrderAccepted"),
      );
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open || !location) return null;
  const activeLocation = location;

  const currentIndex = STEP_IDS.indexOf(step);
  const canContinue =
    step === "choose" ||
    step === "done" ||
    (step === "confirm" &&
      ((mode === "host" && eligibility?.eligible === true) ||
        (mode === "buy" && Boolean(selectedNumber)))) ||
    (step === "registration" &&
      mode === "buy" &&
      Boolean(selectedNumber) &&
      chargeAcknowledged);

  async function checkExisting() {
    if (!location) return;
    setChecking(true);
    try {
      const result = await utils.messaging.checkEligibility.fetch({
        locationId: location.locationId,
      });
      setEligibility(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("messaging.eligibilityFailed"));
    } finally {
      setChecking(false);
    }
  }

  async function searchNumbers() {
    if (!isMessagingAreaCodeInputValid(areaCode)) return;
    setChecking(true);
    setChargeAcknowledged(false);
    setSelectedNumber(null);
    setHasSearched(false);
    try {
      const result = await utils.messaging.searchNumbers.fetch(
        areaCode ? { areaCode } : {},
      );
      setNumbers(result);
      setSelectedNumber(result[0] ?? null);
      setHasSearched(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("messaging.numberSearchFailed"));
    } finally {
      setChecking(false);
    }
  }

  function handleContinue() {
    if (step === "choose") {
      setStep("confirm");
      return;
    }
    if (step === "confirm") {
      if (mode === "host" && eligibility === null) {
        void checkExisting();
        return;
      }
      if (mode === "buy" && numbers.length === 0) {
        void searchNumbers();
        return;
      }
      setStep("registration");
      return;
    }
    if (step === "registration") {
      if (mode !== "buy" || !selectedNumber || !chargeAcknowledged) return;
      provision.mutate({
        locationId: activeLocation.locationId,
        mode: "buy",
        action: "start",
        phoneNumber: selectedNumber.phoneNumber,
        quote: {
          upfrontCost: selectedNumber.upfrontCost,
          monthlyCost: selectedNumber.monthlyCost,
          currency: selectedNumber.currency,
        },
        confirmProviderCharges: true,
      });
      return;
    }
    onOpenChange(false);
  }

  function handleBack() {
    if (step === "choose" || provision.isPending) return;
    const previous = STEP_IDS[Math.max(0, currentIndex - 1)] ?? "choose";
    setStep(previous);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("messaging.textingSetup")}
      className="fixed inset-0 z-[90] overflow-y-auto bg-[linear-gradient(135deg,#f8fafc_0%,#ecfdf5_52%,#f0fdfa_100%)] p-4 text-slate-950 sm:p-6"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-2xl rounded-2xl border border-white/80 bg-white p-6 shadow-xl shadow-emerald-200/30 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <MessageSquare className="h-4 w-4" />
                {t("messaging.textingSetup")}
              </div>
              <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight text-slate-950">
                {stepTitle(step, t)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {location.name}
                {location.isPrimary ? ` ${t("messaging.primaryLocation")}` : ""}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("messaging.closeTextingSetup")}
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex gap-1.5" aria-hidden="true">
            {STEP_IDS.map((stepId, i) => (
              <span
                key={stepId}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= currentIndex ? "bg-emerald-500" : "bg-slate-200",
                )}
              />
            ))}
          </div>

          <div className="mt-6 min-h-[18rem]">
            {step === "choose" ? (
              <ChooseStep
                mode={mode}
                setMode={(nextMode) => {
                  setMode(nextMode);
                  setChargeAcknowledged(false);
                }}
                existingPhone={location.existingPhone}
              />
            ) : null}
            {step === "confirm" ? (
              <ConfirmStep
                hosted={hosted}
                mode={mode}
                location={location}
                eligibility={eligibility}
                checking={checking}
                checkExisting={checkExisting}
                areaCode={areaCode}
                setAreaCode={(nextAreaCode) => {
                  setAreaCode(nextAreaCode);
                  setNumbers([]);
                  setHasSearched(false);
                  setSelectedNumber(null);
                  setChargeAcknowledged(false);
                }}
                numbers={numbers}
                hasSearched={hasSearched}
                selectedNumber={selectedNumber}
                setSelectedNumber={(number) => {
                  setSelectedNumber(number);
                  setChargeAcknowledged(false);
                }}
                searchNumbers={searchNumbers}
              />
            ) : null}
            {step === "registration" ? (
              <RegistrationStep
                hosted={hosted}
                mode={mode}
                location={location}
                selectedNumber={selectedNumber}
                chargeAcknowledged={chargeAcknowledged}
                setChargeAcknowledged={setChargeAcknowledged}
              />
            ) : null}
            {step === "done" ? (
              <DoneStep sender={provisionedSender} hosted={hosted} />
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === "choose" || provision.isPending}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("messaging.back")}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                {t("messaging.stepOf").replace("{current}", String(currentIndex + 1)).replace("{total}", String(STEP_IDS.length))}
              </span>
              <Button
                type="button"
                onClick={handleContinue}
                disabled={!canContinue || checking || provision.isPending}
              >
                {checking || provision.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {continueLabel({ step, mode, eligibility, numbers }, t)}
                {step !== "done" && !checking && !provision.isPending ? (
                  <ArrowRight className="ml-2 h-4 w-4" />
                ) : null}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChooseStep({
  mode,
  setMode,
  existingPhone,
}: {
  mode: MessagingSetupMode;
  setMode: (mode: MessagingSetupMode) => void;
  existingPhone: string | null;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        {t("messaging.chooseNumberDescription")}
      </p>
      <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-500" />
          <div>
            <p className="font-medium text-slate-950">
              {t("messaging.existingNumberUnavailable")}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {existingPhone
                ? t("messaging.existingNumberUnchanged").replace(
                    "{number}",
                    existingPhone,
                  )
                : t("messaging.numberUnchanged")}
            </p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setMode("buy")}
        className={cn(
          "w-full rounded-xl border p-4 text-left transition-colors",
          mode === "buy"
            ? "border-emerald-500 bg-emerald-50"
            : "border-slate-200 hover:border-emerald-300",
        )}
      >
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-slate-950">
              {t("messaging.getNewNumber")}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("messaging.newNumberDescription")}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

function ConfirmStep({
  hosted,
  mode,
  location,
  eligibility,
  checking,
  checkExisting,
  areaCode,
  setAreaCode,
  numbers,
  hasSearched,
  selectedNumber,
  setSelectedNumber,
  searchNumbers,
}: {
  hosted: boolean;
  mode: MessagingSetupMode;
  location: MessagingSetupLocation;
  eligibility: { eligible: boolean; detail?: string } | null;
  checking: boolean;
  checkExisting: () => void;
  areaCode: string;
  setAreaCode: (areaCode: string) => void;
  numbers: SearchNumber[];
  hasSearched: boolean;
  selectedNumber: SearchNumber | null;
  setSelectedNumber: (number: SearchNumber) => void;
  searchNumbers: () => void;
}) {
  const t = useTranslations();
  const locale = dateLocaleForLanguage(useLanguage());
  if (mode === "host") {
    return (
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-600">
          {t("messaging.checkExistingNumber").replace(
            "{number}",
            location.existingPhone ?? t("messaging.thisNumber"),
          )}
        </p>
        {eligibility === null ? (
          <Button variant="outline" onClick={checkExisting} disabled={checking}>
            {checking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {t("messaging.checkEligibility")}
          </Button>
        ) : eligibility.eligible ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Check className="h-4 w-4" />
              {t("messaging.eligibleToText")}
            </p>
            <p className="mt-2 text-sm text-emerald-700">
              {t("messaging.reviewCarrierStep")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              {t("messaging.notEligible")}
            </p>
            <p className="mt-2 text-sm text-amber-800">
              {eligibility.detail ??
                t("messaging.chooseOrUpdatePhone")}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        {t("messaging.searchLocalNumber")
          .replace(
            "{reviewer}",
            hosted ? t("messaging.doctorPetReviews") : t("messaging.adminFinishesActivation"),
          )}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-600">{t("messaging.areaCode")}</span>
          <Input
            value={areaCode}
            onChange={(e) =>
              setAreaCode(
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, MESSAGING_AREA_CODE_LENGTH),
              )
            }
            maxLength={MESSAGING_AREA_CODE_LENGTH}
            inputMode="numeric"
            pattern={`\\d{${MESSAGING_AREA_CODE_LENGTH}}`}
            placeholder="415"
            className="w-28 border-slate-300"
          />
        </label>
        <Button
          variant="outline"
          onClick={searchNumbers}
          disabled={checking || !isMessagingAreaCodeInputValid(areaCode)}
        >
          {checking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {t("messaging.searchNumbers")}
        </Button>
      </div>
      {numbers.length > 0 ? (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
          {numbers.map((n) => (
            <button
              type="button"
              key={n.phoneNumber}
              onClick={() => setSelectedNumber(n)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                selectedNumber?.phoneNumber === n.phoneNumber
                  ? "bg-emerald-50"
                  : "hover:bg-slate-50",
              )}
            >
              <span className="font-medium text-slate-950">
                {n.phoneNumber}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {formatCost(n.upfrontCost, n.currency, locale)} {t("messaging.today")} ·{" "}
                  {formatCost(n.monthlyCost, n.currency, locale)}{t("messaging.perMonth")}
                </span>
                {selectedNumber?.phoneNumber === n.phoneNumber ? (
                  <Badge variant="success">{t("messaging.selected")}</Badge>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : hasSearched ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("messaging.noPricedNumbers")}
        </div>
      ) : null}
    </div>
  );
}

function RegistrationStep({
  hosted,
  mode,
  location,
  selectedNumber,
  chargeAcknowledged,
  setChargeAcknowledged,
}: {
  hosted: boolean;
  mode: MessagingSetupMode;
  location: MessagingSetupLocation;
  selectedNumber: SearchNumber | null;
  chargeAcknowledged: boolean;
  setChargeAcknowledged: (checked: boolean) => void;
}) {
  const t = useTranslations();
  const locale = dateLocaleForLanguage(useLanguage());
  const number =
    mode === "host"
      ? (location.existingPhone ?? t("messaging.yourNumber"))
      : selectedNumber?.phoneNumber;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-950">
          {mode === "host"
            ? t("messaging.existingNumberUnavailable")
            : t("messaging.getNewNumber")}
        </p>
        <p className="mt-1 text-sm text-slate-600">{number}</p>
      </div>
      {mode === "buy" && selectedNumber ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-950">{t("messaging.providerCharges")}</p>
          <p className="mt-2 text-sm text-amber-900">
            {formatCost(selectedNumber.upfrontCost, selectedNumber.currency, locale)}{" "}
            {t("messaging.dueNowThen")} {" "}
            {formatCost(selectedNumber.monthlyCost, selectedNumber.currency, locale)}
            {t("messaging.perMonthForNumber")}
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
        <p className="text-sm font-medium text-teal-950">
          {t("messaging.carrierApprovalRequired")}
        </p>
        <p className="mt-2 text-sm leading-6 text-teal-800">
          {t("messaging.selectedNumberSaved").replace(
            "{reviewer}",
            hosted ? t("messaging.hostedReview") : t("messaging.adminActivation"),
          )}
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <input
          type="checkbox"
          checked={chargeAcknowledged}
          onChange={(event) => setChargeAcknowledged(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-amber-400"
        />
        <span>
          {t("messaging.authorizeCharges")}
        </span>
      </label>
    </div>
  );
}

function DoneStep({
  sender,
  hosted,
}: {
  sender: string | null;
  hosted: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
          <Check className="h-4 w-4" />
          {t("messaging.orderAccepted")}
        </p>
        <p className="mt-2 text-sm leading-6 text-emerald-800">
          {t("messaging.numberSaved").replace("{number}", sender ?? t("messaging.yourNumber"))}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-950">
          {t("messaging.nextCarrierApproval")}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {hosted
            ? t("messaging.completeRegistrationHosted")
            : t("messaging.completeRegistrationAdmin")}
        </p>
      </div>
    </div>
  );
}

function continueLabel({
  step,
  mode,
  eligibility,
  numbers,
}: {
  step: Step;
  mode: MessagingSetupMode;
  eligibility: { eligible: boolean; detail?: string } | null;
  numbers: SearchNumber[];
}, t: ReturnType<typeof useTranslations>) {
  if (step === "choose") return t("messaging.continue");
  if (step === "confirm" && mode === "host" && eligibility === null) {
    return t("messaging.checkEligibility");
  }
  if (step === "confirm" && mode === "buy" && numbers.length === 0) {
    return t("messaging.searchNumbers");
  }
  if (step === "registration") return t("messaging.purchaseStartSetup");
  if (step === "done") return t("messaging.done");
  return t("messaging.continue");
}
