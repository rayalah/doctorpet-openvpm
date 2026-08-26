"use client";

import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage, useTranslations } from "@/lib/i18n/client";
import { dateLocaleForLanguage } from "@/lib/i18n/language";
import {
  PRESCRIPTION_LIFECYCLE_REASON_MAX_LENGTH,
  isPrescriptionLifecycleReasonValid,
  type PrescriptionStatus,
} from "@/lib/records/prescription-lifecycle";

type ActionMode = "refill" | "complete" | "cancel";

export interface PrescriptionLifecycleControlProps {
  prescription: {
    id: string;
    effectiveStatus: PrescriptionStatus;
    productId: string | null;
    quantity: number | null;
    refillsRemaining: number;
  };
  canManage: boolean;
  showControlledDrugComplianceNotice: boolean;
  timeZone?: string | null;
  onChanged: () => void | Promise<void>;
}

function formatEventTime(value: Date | string, timeZone?: string | null, locale = "en-US") {
  const date = value instanceof Date ? value : new Date(value);
  try {
    return date.toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone ?? undefined,
    });
  } catch {
    return date.toLocaleString(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
}

export function PrescriptionLifecycleControl({
  prescription,
  canManage,
  showControlledDrugComplianceNotice,
  timeZone,
  onChanged,
}: PrescriptionLifecycleControlProps) {
  const t = useTranslations();
  const dateLocale = dateLocaleForLanguage(useLanguage());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mode, setMode] = useState<ActionMode | null>(null);
  const [reason, setReason] = useState("");
  const operationId = useRef<string | null>(null);
  const history = trpc.records.listPrescriptionEvents.useQuery(
    { prescriptionId: prescription.id },
    { enabled: historyOpen },
  );

  const resetAction = () => {
    setMode(null);
    setReason("");
    operationId.current = null;
  };
  const finishAction = async (message: string) => {
    toast.success(message);
    await Promise.all([Promise.resolve(onChanged()), history.refetch()]);
    resetAction();
  };
  const refill = trpc.records.recordPrescriptionRefill.useMutation({
    onSuccess: (result) =>
      finishAction(
        result.event.eventType === "refill_dispensed"
          ? t("clinicalRecords.prescription.refillStockSuccess")
          : t("clinicalRecords.prescription.refillAuthorizedSuccess"),
      ),
    onError: () => toast.error(t("clinicalRecords.prescription.actionError")),
  });
  const complete = trpc.records.completePrescription.useMutation({
    onSuccess: () => finishAction(t("clinicalRecords.prescription.completedSuccess")),
    onError: () => toast.error(t("clinicalRecords.prescription.actionError")),
  });
  const cancel = trpc.records.cancelPrescription.useMutation({
    onSuccess: () => finishAction(t("clinicalRecords.prescription.cancelledSuccess")),
    onError: () => toast.error(t("clinicalRecords.prescription.actionError")),
  });
  const isPending = refill.isPending || complete.isPending || cancel.isPending;
  const isActive = prescription.effectiveStatus === "active";
  const isExternalPrescription = !prescription.productId;
  const hasInvalidInventoryLink = Boolean(
    prescription.productId &&
    (!prescription.quantity || prescription.quantity <= 0),
  );
  const canRefill =
    isActive && prescription.refillsRemaining > 0 && !hasInvalidInventoryLink;

  const historyEventLabel = (eventType: string) => {
    switch (eventType) {
      case "created":
        return t("clinicalRecords.prescriptionCreated");
      case "refill_authorized":
        return t("clinicalRecords.prescription.refillAuthorizedSuccess");
      case "completed":
        return t("clinicalRecords.prescription.completedSuccess");
      case "cancelled":
        return t("clinicalRecords.prescription.cancelledSuccess");
      case "expired":
        return t("clinicalRecords.prescriptionExpired");
      default:
        return t("clinicalRecords.prescription.refillStockSuccess");
    }
  };

  const refillsRemainingLabel = (count: number) =>
    `${count} ${t(
      count === 1
        ? "clinicalRecords.prescription.refillRemaining"
        : "clinicalRecords.prescription.refillsRemaining",
    )}`;

  const chargeStatusLabel = (status: "pending" | "invoiced" | "waived") =>
    t(`clinicalRecords.prescription.chargeStatus.${status}`);

  const openAction = (nextMode: ActionMode) => {
    setMode(nextMode);
    setReason("");
    operationId.current = null;
  };

  const submitAction = () => {
    operationId.current ??= crypto.randomUUID();
    if (mode === "refill") {
      refill.mutate({
        id: prescription.id,
        operationId: operationId.current,
        note: reason.trim() || undefined,
      });
      return;
    }
    if (!mode || !isPrescriptionLifecycleReasonValid(reason)) return;
    const input = {
      id: prescription.id,
      operationId: operationId.current,
      reason: reason.trim(),
    };
    if (mode === "complete") complete.mutate(input);
    if (mode === "cancel") cancel.mutate(input);
  };

  return (
    <div className="min-w-[18rem] space-y-2 text-left">
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          {historyOpen ? (
            <ChevronUp className="mr-1 h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="mr-1 h-3.5 w-3.5" />
          )}
          {t("clinicalRecords.prescriptionHistory")}
        </Button>
        {canManage && isActive ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canRefill || isPending}
              title={
                canRefill
                  ? isExternalPrescription
                    ? t("clinicalRecords.prescription.refillExternalTitle")
                    : t("clinicalRecords.prescription.refillStockTitle")
                  : hasInvalidInventoryLink
                    ? t("clinicalRecords.prescription.invalidInventoryQuantity")
                    : t("clinicalRecords.prescription.noRefillsRemaining")
              }
              onClick={() => openAction("refill")}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {isExternalPrescription
                ? t("clinicalRecords.authorizeRefill")
                : t("clinicalRecords.prescription.refillStockTitle")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => openAction("complete")}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {t("clinicalRecords.complete")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => openAction("cancel")}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t("clinicalRecords.cancel")}
            </Button>
          </>
        ) : null}
      </div>

      {mode ? (
        <div className="ml-auto max-w-sm rounded-md border border-border bg-background p-3">
          <p className="text-sm font-medium">
            {mode === "refill"
              ? isExternalPrescription
                ? t("clinicalRecords.prescription.refillExternalTitle")
                : t("clinicalRecords.prescription.refillStockTitle")
              : mode === "complete"
                ? t("clinicalRecords.prescription.completeTitle")
                : t("clinicalRecords.prescription.cancelTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "refill"
              ? isExternalPrescription
                ? t("clinicalRecords.prescription.refillExternalHelp")
                : t("clinicalRecords.prescription.refillStockHelp")
              : t("clinicalRecords.prescription.reasonHelp")}
          </p>
          <Textarea
            className="mt-2 min-h-16"
            value={reason}
            maxLength={PRESCRIPTION_LIFECYCLE_REASON_MAX_LENGTH}
            aria-label={mode === "refill" ? t("clinicalRecords.prescription.refillNote") : t("clinicalRecords.prescription.clinicalReason")}
            aria-invalid={
              mode !== "refill" &&
              reason.length > 0 &&
              !isPrescriptionLifecycleReasonValid(reason)
            }
            placeholder={
              mode === "refill"
                ? t("clinicalRecords.prescription.optionalNote")
                : t("clinicalRecords.prescription.requiredReason")
            }
            onChange={(event) => {
              setReason(event.target.value);
              operationId.current = null;
            }}
          />
          {mode === "refill" &&
          !isExternalPrescription &&
          showControlledDrugComplianceNotice ? (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              {t("clinicalRecords.prescription.controlledDrugNotice")}
            </p>
          ) : null}
          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={resetAction}
            >
              {t("clinicalRecords.back")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                isPending ||
                (mode !== "refill" &&
                  !isPrescriptionLifecycleReasonValid(reason))
              }
              onClick={submitAction}
            >
              {isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {t("clinicalRecords.confirm")}
            </Button>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="ml-auto max-w-sm rounded-md border border-border bg-muted/30 p-3">
          {history.isLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("clinicalRecords.loadingHistory")}
            </p>
          ) : history.error || !history.data ? (
            <div className="space-y-2">
              <p className="text-xs text-destructive">
                {t("clinicalRecords.prescription.historyLoadError")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => history.refetch()}
              >
                {t("clinicalRecords.retry")}
              </Button>
            </div>
          ) : history.data.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("clinicalRecords.noLifecycleHistory")}
            </p>
          ) : (
            <ol className="space-y-3">
              {history.data.map((event) => (
                <li
                  key={event.id}
                  className="border-l-2 border-border pl-3 text-xs"
                >
                  <p className="font-medium">
                    {historyEventLabel(event.eventType)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatEventTime(event.createdAt, timeZone, dateLocale)} ·{" "}
                    {event.actorName}
                  </p>
                  {event.eventType === "refill_dispensed" ? (
                    <p className="text-muted-foreground">
                      {t("clinicalRecords.prescription.dispensed")} {event.quantity};{" "}
                      {refillsRemainingLabel(event.refillsAfter)}
                    </p>
                  ) : event.eventType === "refill_authorized" ? (
                    <p className="text-muted-foreground">
                      {t("clinicalRecords.prescription.externalRefillAuthorized")};{" "}
                      {refillsRemainingLabel(event.refillsAfter)}
                    </p>
                  ) : null}
                  {event.dispenseChargeStatus ? (
                    <p className="mt-1 font-medium">
                      {t("clinicalRecords.prescription.billing")}: {" "}
                      {chargeStatusLabel(event.dispenseChargeStatus)}
                      {event.dispenseChargeInvoiceId
                        ? ` ${t("clinicalRecords.prescription.onInvoice")}`
                        : ""}
                    </p>
                  ) : null}
                  {event.reason ? <p className="mt-1">{event.reason}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}
