"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  Loader2,
  Package,
  Pill,
  Plus,
  Receipt,
  Stethoscope,
  Save,
  Scissors,
  Syringe,
  Trash2,
  UserRound,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage, useTranslations } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/messages";
import { formatCurrency } from "@/lib/locale/format";
import {
  BILLING_INVOICE_MAX_ITEMS,
  isBillingInvoiceLineTotalValid,
  isBillingInvoiceSubtotalValid,
} from "@/lib/billing/policy";
import { centsToMoney, moneyToCents } from "@/lib/billing/invoice-balance";
import { tryCalculateInvoiceTaxTotals } from "@/lib/billing/invoice-tax";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  getVisitCompletionAction,
  requiresPrescriptionInventoryUnitReview,
} from "@/lib/encounters/visit-completion";
import {
  APPOINTMENT_PATIENT_SEARCH_MAX_LENGTH,
  isAppointmentPatientSearchInputValid,
} from "@/lib/scheduling/appointment-policy";
import { ServicePicker } from "@/components/billing/service-picker";
import { CapturePhotos } from "@/components/records/capture-photos";
import { ConsentSign } from "@/components/records/consent-sign";
import { EncounterVitalsCard } from "@/components/records/encounter-vitals-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/empty-state";
import type { AppRouter } from "@/server/routers/_app";

const TreatmentPlanComposer = dynamic(
  () =>
    import("@/components/encounters/treatment-plan-composer").then(
      (module) => module.TreatmentPlanComposer,
    ),
  { ssr: false, loading: () => null },
);

type RouterOutputs = inferRouterOutputs<AppRouter>;
type CloseoutQueryState = {
  data: RouterOutputs["encounters"]["getCloseout"] | undefined;
  error: { message: string } | null;
  isLoading: boolean;
};
type InvoiceQueryState = {
  data: RouterOutputs["billing"]["listInvoices"] | undefined;
  error: { message: string } | null;
  isLoading: boolean;
};

type ChargeItem = {
  key: string;
  description: string;
  quantity: number;
  unitPrice: string;
  itemType: "service" | "product";
  itemId?: string;
  taxable: boolean;
  sourcePrescriptionId?: string;
  sourceDispenseChargeId?: string;
};

type ClinicalDraftFields = {
  diagnosisSummary: string;
  dischargeInstructions: string;
  warningSigns: string;
  noInstructionsReason: string;
  prescriptionDisposition: "" | "prescribed" | "not_needed";
  followUpDisposition: "" | "none" | "needed" | "scheduled";
  followUpNotes: string;
  followUpAppointmentId: string;
  followUpDueDate: string;
  followUpAssignedTo: string;
  documentationExceptionReason: string;
};

function chargeItemsFingerprint(items: ChargeItem[]): string {
  return JSON.stringify(
    items.map((item) => [
      item.description,
      item.quantity,
      item.unitPrice,
      item.itemType,
      item.itemId ?? null,
      item.taxable,
      item.sourcePrescriptionId ?? null,
      item.sourceDispenseChargeId ?? null,
    ]),
  );
}

function clinicalDraftFingerprint(fields: ClinicalDraftFields): string {
  return JSON.stringify([
    fields.diagnosisSummary,
    fields.dischargeInstructions,
    fields.warningSigns,
    fields.noInstructionsReason,
    fields.prescriptionDisposition,
    fields.followUpDisposition,
    fields.followUpNotes,
    fields.followUpAppointmentId,
    fields.followUpDueDate,
    fields.followUpAssignedTo,
    fields.documentationExceptionReason,
  ]);
}

const APPOINTMENT_STATUS_LABELS: Record<string, Parameters<Translator>[0]> = {
  scheduled: "appointments.status.scheduled",
  confirmed: "appointments.status.confirmed",
  checked_in: "appointments.status.checked_in",
  in_exam: "appointments.status.in_exam",
  checked_out: "appointments.status.checked_out",
  no_show: "appointments.status.no_show",
  cancelled: "appointments.status.cancelled",
};

function appointmentStatusLabel(status: string, t: Translator): string {
  const labelKey = APPOINTMENT_STATUS_LABELS[status];
  return labelKey ? t(labelKey) : status;
}

function canManageVisit(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function canCreateSoap(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

function canRecordVitals(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "technician";
}

function canRecordVisitWork(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian" || role === "technician";
}

function canRecordProcedure(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

function canManageBilling(role?: string | null): boolean {
  return role === "admin" || role === "front_desk";
}

function nextVisitAction(status: string): {
  label: Parameters<Translator>[0];
  status: "checked_in" | "in_exam";
} | null {
  if (status === "scheduled" || status === "confirmed") {
    return { label: "visit.checkIn", status: "checked_in" };
  }
  if (status === "checked_in") {
    return { label: "visit.startExam", status: "in_exam" };
  }
  return null;
}

function invoiceStatusLabel(status: string, t: Translator): string {
  const keyByStatus: Record<string, Parameters<Translator>[0]> = {
    draft: "visit.appointmentStatus.draft",
    sent: "visit.appointmentStatus.sent",
    paid: "visit.appointmentStatus.paid",
    overdue: "visit.appointmentStatus.overdue",
    void: "visit.appointmentStatus.void",
    cancelled: "visit.appointmentStatus.cancelled",
  };
  const key = keyByStatus[status];
  return key ? t(key) : status;
}

function visitSourceTypeLabel(sourceType: string, t: Translator): string {
  if (sourceType === "prescription") return t("visit.sourceType.prescription");
  if (sourceType === "vaccination") return t("visit.sourceType.vaccination");
  if (sourceType === "procedure") return t("visit.sourceType.procedure");
  if (sourceType === "lab") return t("visit.sourceType.lab");
  return sourceType;
}

function roleLabel(role: string, t: Translator): string {
  if (role === "admin") return t("visit.role.admin");
  if (role === "veterinarian") return t("visit.role.veterinarian");
  if (role === "technician") return t("visit.role.technician");
  if (role === "front_desk") return t("visit.role.frontDesk");
  return role.replace("_", " ");
}

function chargeDispositionLabel(
  disposition: string | null | undefined,
  t: Translator,
): string {
  if (disposition === "paid") return t("visit.paid");
  if (disposition === "accounts_receivable") return t("visit.accountsReceivable");
  if (disposition === "no_charge") return t("visit.noCharge");
  return disposition?.replace("_", " ") ?? t("visit.notRecorded");
}

function handoffMethodLabel(
  method: string | null | undefined,
  t: Translator,
): string {
  if (method === "print") return t("visit.printedDownloaded");
  if (method === "verbal") return t("visit.reviewedVerbally");
  if (method === "declined") return t("visit.ownerDeclined");
  return method?.replace("_", " ") ?? t("visit.notRecorded");
}

function PatientAssignmentPanel({
  appointmentId,
  clientName,
}: {
  appointmentId: string;
  clientName: string;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    breed: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const searchIsValid = isAppointmentPatientSearchInputValid(search);
  const canSearch = deferredSearch.length > 0 && searchIsValid;
  const patientSearch = trpc.patients.search.useQuery(
    { query: deferredSearch, status: "active" },
    { enabled: canSearch },
  );
  const attachPatient = trpc.appointments.attachPatient.useMutation({
    onSuccess: async () => {
      toast.success(t("visit.patientAttached"));
      await Promise.all([
        utils.appointments.getById.invalidate({ id: appointmentId }),
        utils.appointments.list.invalidate(),
        utils.encounters.getCloseout.invalidate({ appointmentId }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <UserRound className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">{t("visit.attachBeforeCare")}</p>
          <p className="mt-1 text-sm">
            {clientName
              ? t("visit.choosePatientForClient").replace("{client}", clientName)
              : t("visit.choosePatient")}{" "}
            {t("visit.examRequiresMatch")}
          </p>
        </div>
      </div>

      {selectedPatient ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-background/80 p-3 text-sm text-foreground dark:border-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{selectedPatient.name}</p>
              <p className="text-xs text-muted-foreground">
                {[selectedPatient.species, selectedPatient.breed]
                  .filter(Boolean)
                  .join(" · ") || t("visit.patientDetailsUnavailable")}
                {selectedPatient.clientFirstName
                  ? " · " +
                    selectedPatient.clientFirstName +
                    " " +
                    (selectedPatient.clientLastName ?? "")
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={attachPatient.isPending}
                onClick={() => setSelectedPatient(null)}
              >
                {t("visit.change")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={attachPatient.isPending}
                onClick={() =>
                  attachPatient.mutate({
                    id: appointmentId,
                    patientId: selectedPatient.id,
                  })
                }
              >
                {attachPatient.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("visit.attachPatient")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Input
            value={search}
            maxLength={APPOINTMENT_PATIENT_SEARCH_MAX_LENGTH}
            aria-label={t("visit.searchPatientToAttach")}
            aria-invalid={!searchIsValid}
            placeholder={t("visit.searchPatientOwnerBreed")}
            onChange={(event) => setSearch(event.target.value)}
          />
          {!searchIsValid ? (
            <p className="mt-2 text-xs text-destructive">
              {t("visit.patientSearchTooLong")}
            </p>
          ) : patientSearch.error ? (
            <p className="mt-2 text-xs text-destructive">
              {t("visit.patientSearchFailed")}
            </p>
          ) : canSearch && patientSearch.isLoading ? (
            <p className="mt-2 inline-flex items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("visit.searchingPatients")}
            </p>
          ) : canSearch && patientSearch.data?.length === 0 ? (
            <p className="mt-2 text-xs">
              {t("visit.noActivePatient")} {" "}
              <Link className="font-medium underline" href="/patients/new">
                {t("visit.createPatientRecord")}
              </Link>{" "}
              {t("visit.returnToVisit")}
            </p>
          ) : patientSearch.data?.length ? (
            <div className="mt-2 overflow-hidden rounded-md border border-amber-300 bg-background text-foreground dark:border-amber-800">
              {patientSearch.data.map((patient) => (
                <button
                  type="button"
                  key={patient.id}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
                  onClick={() => setSelectedPatient(patient)}
                >
                  <span>
                    <span className="font-medium">{patient.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[patient.species, patient.breed]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[patient.clientFirstName, patient.clientLastName]
                      .filter(Boolean)
                      .join(" ") || t("visit.noActiveClient")}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatAppointmentTime(
  value: Date | string,
  timeZone?: string | null,
  locale = "en-US",
): string {
  try {
    return new Date(value).toLocaleString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone ?? undefined,
    });
  } catch {
    return new Date(value).toLocaleString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

function addDateInputDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function defaultPayLaterDueDate(timeZone?: string | null): string {
  const today = formatDateInputForTimeZone(new Date(), timeZone);
  return addDateInputDays(today, 30);
}

function formatClinicDate(value: string, locale = "en-US"): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString(
    locale,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    },
  );
}

function EncounterLoading() {
  const t = useTranslations();
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("visit.loading")}
    </div>
  );
}

export default function EncounterWorkspacePage() {
  const t = useTranslations();
  const language = useLanguage();
  const locale = language === "es" ? "es-CR" : "en-US";
  const params = useParams<{ appointmentId: string }>();
  const { data: session, status: sessionStatus } = useSession();
  const appointmentId = params.appointmentId;
  const utils = trpc.useUtils();

  const appointmentQuery = trpc.appointments.getById.useQuery(
    { id: appointmentId },
    { enabled: Boolean(appointmentId) },
  );
  const appointment = appointmentQuery.data;
  const patientQuery = trpc.patients.getById.useQuery(
    { id: appointment?.patientId ?? "" },
    { enabled: Boolean(appointment?.patientId) },
  );
  const taxConfigQuery = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const invoicesQuery = trpc.billing.listInvoices.useQuery(
    { appointmentId, limit: 25, offset: 0 },
    { enabled: Boolean(appointmentId) },
  );
  const closeoutQuery = trpc.encounters.getCloseout.useQuery(
    { appointmentId },
    { enabled: Boolean(appointmentId) },
  );

  const updateStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(t("visit.visitStatusUpdated"));
      utils.appointments.getById.invalidate({ id: appointmentId });
      utils.appointments.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (sessionStatus === "loading" || appointmentQuery.isLoading) {
    return <EncounterLoading />;
  }

  if (appointmentQuery.error || !appointment) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t("visit.loadError")}
        description={
          appointmentQuery.error?.message ??
          t("visit.loadErrorDescription")
        }
        action={{
          label: t("visit.backToSchedule"),
          onClick: () => window.location.assign("/schedule"),
          icon: ArrowLeft,
        }}
      />
    );
  }

  const role = session?.user?.role;
  const patient = patientQuery.data;
  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(" ");
  const nextAction = nextVisitAction(appointment.status);
  const visitClinicalStateReady =
    Boolean(closeoutQuery.data) && !closeoutQuery.error;
  const visitOpenForClinicalEntry =
    visitClinicalStateReady &&
    appointment.status === "in_exam" &&
    closeoutQuery.data?.closeout?.status !== "clinical_finalized" &&
    closeoutQuery.data?.closeout?.status !== "completed";
  const missingClinicalTarget = !appointment.patientId || !appointment.clientId;
  const activeInvoices =
    invoicesQuery.data?.items.filter(
      (invoice) => !invoice.isEstimate && invoice.status !== "void",
    ) ?? [];
  const visitInvoices = invoicesQuery.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/schedule">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("visit.backToSchedule")}
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold">
                {appointment.patientName ?? t("visit.unassigned")}
              </h1>
              <Badge variant="outline">
                {appointmentStatusLabel(appointment.status, t)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {appointment.typeName ?? t("visit.appointment")} ·{" "}
              {clientName || t("visit.noClient")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                  {formatAppointmentTime(
                    appointment.startTime,
                    taxConfigQuery.data?.timezone,
                    locale,
                )}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {appointment.doctorName
                  ? `Dr. ${appointment.doctorName}`
                  : t("visit.unassignedProvider")}
              </span>
              {appointment.locationName || appointment.roomName ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {[appointment.locationName, appointment.roomName]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {nextAction && canManageVisit(role) ? (
          <Button
            disabled={
              updateStatus.isPending ||
              (nextAction.status === "in_exam" && missingClinicalTarget)
            }
            title={
              nextAction.status === "in_exam" && missingClinicalTarget
                ? t("visit.attachPatientBeforeExam")
                : undefined
            }
            onClick={() =>
              updateStatus.mutate({
                id: appointmentId,
                status: nextAction.status,
              })
            }
          >
            {updateStatus.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            {t(nextAction.label)}
          </Button>
        ) : appointment.status === "in_exam" && canManageVisit(role) ? (
          <Button
            onClick={() => {
              const closeout = document.getElementById("visit-closeout");
              closeout?.scrollIntoView({ behavior: "smooth", block: "start" });
              closeout?.focus({ preventScroll: true });
            }}
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            {t("visit.reviewCloseout")}
          </Button>
        ) : null}
      </header>

      <VisitCompletionGuide
        appointmentId={appointmentId}
        appointmentStatus={appointment.status}
        patientId={appointment.patientId}
        role={role}
        closeoutQuery={closeoutQuery}
        invoicesQuery={invoicesQuery}
        hasActiveInvoice={activeInvoices.length > 0}
      />

      {appointment.notes ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">{t("visit.visitNote")}</span> {appointment.notes}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="flex flex-col gap-6">
          <Card id="clinical-work" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>{t("visit.clinicalWork")}</CardTitle>
              <CardDescription>
                {t("visit.clinicalWorkDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!appointment.patientId ? (
                canManageVisit(role) ? (
                  <PatientAssignmentPanel
                    appointmentId={appointmentId}
                    clientName={clientName}
                  />
                ) : (
                  <EmptyState
                    icon={UserRound}
                    title={t("visit.patientAssignmentRequired")}
                    description={t("visit.patientAssignmentDescription")}
                    className="p-8"
                  />
                )
              ) : patientQuery.error ||
                (!patientQuery.isLoading && !patient) ? (
                <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                  {t("visit.patientChartLoadError")}
                </div>
              ) : patientQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("visit.loadingPatientContext")}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{patient?.name}</p>
                        <p className="text-sm capitalize text-muted-foreground">
                          {[patient?.species, patient?.breed]
                            .filter(Boolean)
                            .join(" · ") || t("visit.patientDetailsUnavailable")}
                        </p>
                      </div>
                      {!patient?.allergies.length ? (
                        <Badge variant="secondary">{t("visit.noRecordedAllergies")}</Badge>
                      ) : null}
                    </div>
                    {patient?.allergies.length ? (
                      <div
                        className="mt-3 grid gap-2"
                        role="alert"
                        aria-label={t("visit.currentAllergyWarnings")}
                      >
                        {patient.allergies.map((allergy) => (
                          <div
                            key={allergy.id}
                            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-destructive">
                                {allergy.allergen}
                              </span>
                              <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                                {allergy.severity}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-foreground">
                              {t("visit.reaction")} {allergy.reaction || t("visit.notDocumented")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canCreateSoap(role) &&
                    closeoutQuery.data?.linkedSoapCount === 0 &&
                    !closeoutQuery.data?.soapDraft &&
                    closeoutQuery.data?.missingSoapReplacement ? (
                      <Button size="sm" asChild>
                        <Link
                          href={`/records/replace-soap/${appointment.patientId}?sourceNoteId=${closeoutQuery.data.missingSoapReplacement.sourceNoteId}&return=patient`}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {t("visit.createMissingSoapReplacement")}
                        </Link>
                      </Button>
                    ) : null}
                    {canCreateSoap(role) &&
                    appointment.status === "in_exam" &&
                    closeoutQuery.data?.linkedSoapCount === 0 &&
                    !closeoutQuery.data?.missingSoapReplacement &&
                    closeoutQuery.data?.closeout?.status !==
                      "clinical_finalized" &&
                    closeoutQuery.data?.closeout?.status !== "completed" ? (
                      <Button size="sm" asChild>
                        <a
                          href={`/records/new-soap/${appointment.patientId}?appointmentId=${appointmentId}`}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {closeoutQuery.data?.soapDraft
                            ? t("visit.resumeSoapDraft")
                            : t("visit.writeSoapNote")}
                        </a>
                      </Button>
                    ) : null}
                    {canCreateSoap(role) && visitOpenForClinicalEntry ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=prescriptions&new=1`}
                        >
                          <Pill className="mr-2 h-4 w-4" />
                          {t("visit.prescribe")}
                        </Link>
                      </Button>
                    ) : null}
                    {canRecordVisitWork(role) && visitOpenForClinicalEntry ? (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=vaccinations&new=1`}
                          >
                            <Syringe className="mr-2 h-4 w-4" />
                            {t("visit.vaccination")}
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=labResults&new=1`}
                          >
                            <FlaskConical className="mr-2 h-4 w-4" />
                            {t("visit.labResult")}
                          </Link>
                        </Button>
                      </>
                    ) : null}
                    {canRecordProcedure(role) && visitOpenForClinicalEntry ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/records?patientId=${appointment.patientId}&appointmentId=${appointmentId}&tab=procedures&new=1`}
                        >
                          <Scissors className="mr-2 h-4 w-4" />
                          {t("visit.procedure")}
                        </Link>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/patients/${appointment.patientId}`}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        {t("visit.openPatientChart")}
                      </Link>
                    </Button>
                    {canManageVisit(role) ? (
                      <>
                        <CapturePhotos
                          patientId={appointment.patientId}
                          appointmentId={appointmentId}
                        />
                        <ConsentSign
                          patientId={appointment.patientId}
                          appointmentId={appointmentId}
                        />
                      </>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {t("visit.actionsDescription")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {appointment.patientId ? (
            <EncounterVitalsCard
              patientId={appointment.patientId}
              appointmentId={appointment.id}
              canRecord={visitOpenForClinicalEntry && canRecordVitals(role)}
              canCorrect={canCreateSoap(role)}
              visitStateReady={visitClinicalStateReady}
              visitOpen={visitOpenForClinicalEntry}
              timeZone={taxConfigQuery.data?.timezone}
            />
          ) : null}

          {canRecordVitals(role) &&
          appointment.patientId &&
          appointment.clientId ? (
            <TreatmentPlanComposer
              appointmentId={appointment.id}
              clientId={appointment.clientId}
              patientId={appointment.patientId}
               patientName={appointment.patientName ?? t("visit.patient")}
            />
          ) : null}

          <VisitCloseout
            appointment={appointment}
            appointmentId={appointmentId}
            role={role}
            closeoutQuery={closeoutQuery}
            invoicesQuery={invoicesQuery}
          />

          <EncounterInvoices
            appointmentId={appointmentId}
            invoicesQuery={invoicesQuery}
            visitInvoices={visitInvoices}
            canManage={
              canManageBilling(role) &&
              closeoutQuery.data?.closeout?.status !== "completed"
            }
          />

          <VisitWorkReconciliation
            appointmentId={appointmentId}
            canManage={canManageVisit(role) && appointment.status === "in_exam"}
            canCorrect={
              appointment.status === "in_exam" &&
              (role === "admin" ||
                role === "veterinarian" ||
                role === "front_desk")
            }
            canVoid={role === "admin" || role === "veterinarian"}
          />
        </div>

        <div id="charge-capture" className="scroll-mt-4">
          <ChargeCapture
            appointmentId={appointmentId}
            clientId={appointment.clientId}
            patientId={appointment.patientId}
            canManage={
              canManageBilling(role) &&
              appointment.status === "in_exam" &&
              closeoutQuery.data?.closeout?.status !== "completed"
            }
            activeInvoice={
              activeInvoices[0]
                ? {
                    id: activeInvoices[0].id,
                    status: activeInvoices[0].status,
                  }
                : null
            }
            invoiceStateReady={
              Boolean(invoicesQuery.data) && !invoicesQuery.error
            }
            invoiceStateLoading={invoicesQuery.isLoading}
            linkedPrescriptions={closeoutQuery.data?.medications ?? []}
          />
        </div>
      </div>
    </div>
  );
}

function VisitCompletionGuide({
  appointmentId,
  appointmentStatus,
  patientId,
  role,
  closeoutQuery,
  invoicesQuery,
  hasActiveInvoice,
}: {
  appointmentId: string;
  appointmentStatus: string;
  patientId: string | null;
  role?: string | null;
  closeoutQuery: CloseoutQueryState;
  invoicesQuery: InvoiceQueryState;
  hasActiveInvoice: boolean;
}) {
  const t = useTranslations();
  const reconciliation = trpc.encounters.getVisitReconciliation.useQuery(
    { appointmentId },
    { enabled: Boolean(appointmentId && patientId) },
  );
  const closeoutStatus = closeoutQuery.data?.closeout?.status;
  const completed = closeoutStatus === "completed";
  const clinicalRecordComplete =
    (closeoutQuery.data?.linkedSoapCount ?? 0) > 0 ||
    closeoutStatus === "clinical_finalized" ||
    completed;
  const billingComplete =
    hasActiveInvoice ||
    (completed &&
      closeoutQuery.data?.closeout?.chargeDisposition === "no_charge");
  const reconciliationComplete =
    Boolean(reconciliation.data) && reconciliation.data?.unresolvedCount === 0;
  const handoffComplete = closeoutStatus === "clinical_finalized" || completed;
  const stateReady =
    Boolean(closeoutQuery.data) &&
    !closeoutQuery.error &&
    Boolean(invoicesQuery.data) &&
    !invoicesQuery.error &&
    Boolean(reconciliation.data) &&
    !reconciliation.error;
  const action = getVisitCompletionAction({
    appointmentStatus,
    hasPatient: Boolean(patientId),
    closeoutStatus,
    stateReady,
    linkedSoapCount: closeoutQuery.data?.linkedSoapCount,
    hasActiveInvoice,
    unresolvedWorkCount: reconciliation.data?.unresolvedCount,
    canCreateSoap: canCreateSoap(role),
    canManageBilling: canManageBilling(role),
    canManageVisit: canManageVisit(role),
  });
  const steps = [
    { label: t("visit.clinicalRecord"), complete: clinicalRecordComplete },
    { label: t("visit.visitCharges"), complete: billingComplete },
    { label: t("visit.reconcileWork"), complete: reconciliationComplete },
    { label: t("visit.ownerHandoff"), complete: handoffComplete },
    { label: t("visit.checkout"), complete: completed },
  ];
  const actionHref =
    action.target === "patient"
      ? "#clinical-work"
      : action.target === "soap" && patientId
        ? `/records/new-soap/${patientId}?appointmentId=${appointmentId}`
        : action.target === "charge_capture"
          ? "#charge-capture"
          : action.target === "reconciliation"
            ? "#visit-work-reconciliation"
            : action.target === "closeout"
              ? "#visit-closeout"
              : action.target === "complete"
                ? "/schedule"
                : null;
  const actionLabel =
    action.target === "patient"
      ? t("visit.attachPatientAction")
      : action.target === "soap"
        ? t("visit.writeSoapNote")
        : action.target === "charge_capture"
          ? t("visit.captureCharges")
          : action.target === "reconciliation"
            ? t("visit.reconcileWork")
            : action.target === "closeout"
              ? handoffComplete
                ? t("visit.completeCheckout")
                : t("visit.finishOwnerHandoff")
              : action.target === "complete"
                ? t("visit.backToSchedule")
                : null;

  const actionTitle =
    action.target === "complete"
      ? t("visit.action.visitComplete")
      : action.target === "patient"
        ? t("visit.action.attachPatient")
        : action.target === "loading"
          ? t("visit.action.confirmingState")
          : action.target === "soap"
            ? t("visit.action.document")
            : action.target === "charge_capture"
              ? t("visit.action.captureCharges")
              : action.target === "reconciliation"
                ? t("visit.action.reconcile")
                : action.target === "closeout"
                  ? handoffComplete
                    ? t("visit.action.completeCheckout")
                    : t("visit.action.finalizeHandoff")
                  : action.title === "Clinical documentation needs a veterinarian"
                    ? t("visit.action.documentationNeedsVet")
                    : action.title === "Billing needs the front desk"
                      ? t("visit.action.billingNeedsFrontDesk")
                      : action.title === "Performed work needs reconciliation"
                        ? t("visit.action.reconcileNeedsTeammate")
                        : action.title === "Owner handoff needs a clinical teammate"
                          ? t("visit.action.handoffNeedsClinical")
                          : t("visit.action.checkoutNeedsTeammate");
  const actionDescription =
    action.target === "complete"
      ? t("visit.action.visitCompleteDescription")
      : action.target === "patient"
        ? t("visit.action.attachPatientDescription")
        : action.target === "loading"
          ? t("visit.action.confirmingStateDescription")
          : action.target === "soap"
            ? t("visit.action.documentDescription")
            : action.target === "charge_capture"
              ? t("visit.action.captureChargesDescription")
              : action.target === "reconciliation"
                ? t("visit.action.reconcileDescription")
                : action.target === "closeout"
                  ? handoffComplete
                    ? t("visit.action.completeCheckoutDescription")
                    : t("visit.action.finalizeHandoffDescription")
                  : action.title === "Clinical documentation needs a veterinarian"
                    ? t("visit.action.documentationNeedsVetDescription")
                    : action.title === "Billing needs the front desk"
                      ? t("visit.action.billingNeedsFrontDeskDescription")
                      : action.title === "Performed work needs reconciliation"
                        ? t("visit.action.reconcileNeedsTeammateDescription")
                        : action.title === "Owner handoff needs a clinical teammate"
                          ? t("visit.action.handoffNeedsClinicalDescription")
                          : t("visit.action.checkoutNeedsTeammateDescription");

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("visit.finishThisVisit")}
            </p>
            <CardTitle className="mt-1">{actionTitle}</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              {actionDescription}
            </CardDescription>
          </div>
          {actionHref && actionLabel ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild>
                <a href={actionHref}>
                  {actionLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              {action.target === "charge_capture" ? (
                <Button variant="ghost" asChild>
                  <a href="#visit-closeout">{t("visit.noChargeContinueHandoff")}</a>
                </Button>
              ) : null}
            </div>
          ) : action.target === "loading" ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("visit.checkingVisit")}
            </div>
          ) : null}
        </div>
        {action.target === "soap" ? (
          <p className="text-xs text-muted-foreground">
            {t("visit.soapExceptionHint")}
          </p>
        ) : action.target === "charge_capture" ? (
          <p className="text-xs text-muted-foreground">
            {t("visit.chargeHint")}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <ol
          className="grid gap-2 sm:grid-cols-5"
          aria-label={t("visit.completionProgress")}
        >
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs"
            >
              <span
                className={
                  step.complete
                    ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
                }
              >
                {step.complete ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span
                className={
                  step.complete ? "font-medium" : "text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function splitOwnerInstructions(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function VisitCloseout({
  appointment,
  appointmentId,
  role,
  closeoutQuery,
  invoicesQuery,
}: {
  appointment: {
    status: string;
    patientId: string | null;
    patientName: string | null;
    patientSpecies: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
    doctorName: string | null;
    startTime: Date | string;
    typeRequiresDoctor: number | null;
  };
  appointmentId: string;
  role?: string | null;
  closeoutQuery: CloseoutQueryState;
  invoicesQuery: InvoiceQueryState;
}) {
  const t = useTranslations();
  const locale = useLanguage() === "es" ? "es-CR" : "en-US";
  const utils = trpc.useUtils();
  const isOnline = useOnlineStatus();
  const clinicalProfileQuery = trpc.settings.getMyClinicalProfile.useQuery(
    undefined,
    { enabled: role === "admin" },
  );
  const data = closeoutQuery.data;
  const closeout = data?.closeout ?? null;
  const activeInvoice = data?.invoices[0] ?? null;
  const hydratedRevision = useRef<string | null>(null);
  const hydratedInvoice = useRef<string | null>(null);
  const [diagnosisSummary, setDiagnosisSummary] = useState("");
  const [dischargeInstructions, setDischargeInstructions] = useState("");
  const [warningSigns, setWarningSigns] = useState("");
  const [noInstructionsReason, setNoInstructionsReason] = useState("");
  const [prescriptionDisposition, setPrescriptionDisposition] = useState<
    "" | "prescribed" | "not_needed"
  >("");
  const [followUpDisposition, setFollowUpDisposition] = useState<
    "" | "none" | "needed" | "scheduled"
  >("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpAppointmentId, setFollowUpAppointmentId] = useState("");
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [followUpAssignedTo, setFollowUpAssignedTo] = useState("");
  const [documentationExceptionReason, setDocumentationExceptionReason] =
    useState("");
  const [chargeDisposition, setChargeDisposition] = useState<
    "" | "paid" | "accounts_receivable" | "no_charge"
  >("");
  const [noChargeReason, setNoChargeReason] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [handoffMethod, setHandoffMethod] = useState<
    "" | "print" | "verbal" | "declined"
  >("");
  const [amendmentReason, setAmendmentReason] = useState("");
  const [followUpResolution, setFollowUpResolution] = useState<
    "" | "scheduled" | "completed" | "not_needed"
  >("");
  const [resolutionAppointmentId, setResolutionAppointmentId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [draftSaveState, setDraftSaveState] = useState<
    "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict"
  >("idle");
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const draftInitializedRef = useRef(false);
  const revisionRef = useRef(0);
  const lastSavedFingerprintRef = useRef("");
  const savePromiseRef = useRef<Promise<unknown> | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const conflictRef = useRef(false);
  const fieldsRef = useRef<ClinicalDraftFields>({
    diagnosisSummary,
    dischargeInstructions,
    warningSigns,
    noInstructionsReason,
    prescriptionDisposition,
    followUpDisposition,
    followUpNotes,
    followUpAppointmentId,
    followUpDueDate,
    followUpAssignedTo,
    documentationExceptionReason,
  });
  fieldsRef.current = {
    diagnosisSummary,
    dischargeInstructions,
    warningSigns,
    noInstructionsReason,
    prescriptionDisposition,
    followUpDisposition,
    followUpNotes,
    followUpAppointmentId,
    followUpDueDate,
    followUpAssignedTo,
    documentationExceptionReason,
  };

  const applyClinicalFields = useCallback((fields: ClinicalDraftFields) => {
    setDiagnosisSummary(fields.diagnosisSummary);
    setDischargeInstructions(fields.dischargeInstructions);
    setWarningSigns(fields.warningSigns);
    setNoInstructionsReason(fields.noInstructionsReason);
    setPrescriptionDisposition(fields.prescriptionDisposition);
    setFollowUpDisposition(fields.followUpDisposition);
    setFollowUpNotes(fields.followUpNotes);
    setFollowUpAppointmentId(fields.followUpAppointmentId);
    setFollowUpDueDate(fields.followUpDueDate);
    setFollowUpAssignedTo(fields.followUpAssignedTo);
    setDocumentationExceptionReason(fields.documentationExceptionReason);
    fieldsRef.current = fields;
  }, []);

  useEffect(() => {
    if (!data) return;
    const key = closeout ? `${closeout.id}:${closeout.revision}` : "empty";
    if (hydratedRevision.current === key) return;
    const clinicalSource = closeout?.amendmentDraft ?? closeout;
    const serverFields: ClinicalDraftFields = {
      diagnosisSummary: clinicalSource?.diagnosisSummary ?? "",
      dischargeInstructions: clinicalSource?.dischargeInstructions ?? "",
      warningSigns: clinicalSource?.warningSigns ?? "",
      noInstructionsReason: clinicalSource?.noInstructionsReason ?? "",
      prescriptionDisposition: clinicalSource?.prescriptionDisposition ?? "",
      followUpDisposition: clinicalSource?.followUpDisposition ?? "",
      followUpNotes: clinicalSource?.followUpNotes ?? "",
      followUpAppointmentId: clinicalSource?.followUpAppointmentId ?? "",
      followUpDueDate: clinicalSource?.followUpDueDate ?? "",
      followUpAssignedTo: clinicalSource?.followUpAssignedTo ?? "",
      documentationExceptionReason:
        clinicalSource?.documentationExceptionReason ?? "",
    };
    const serverRevision = closeout?.revision ?? 0;
    const localDirty =
      clinicalDraftFingerprint(fieldsRef.current) !==
      lastSavedFingerprintRef.current;
    if (
      draftInitializedRef.current &&
      serverRevision > revisionRef.current &&
      (localDirty || savePromiseRef.current)
    ) {
      conflictRef.current = true;
      setConflictRevision(serverRevision);
      setDraftSaveState("conflict");
      return;
    }
    if (draftInitializedRef.current && serverRevision <= revisionRef.current) {
      hydratedRevision.current = key;
      return;
    }
    applyClinicalFields(serverFields);
    revisionRef.current = serverRevision;
    lastSavedFingerprintRef.current = clinicalDraftFingerprint(serverFields);
    setLastDraftSavedAt(closeout?.updatedAt ?? null);
    setDraftSaveState(closeout ? "saved" : "idle");
    conflictRef.current = false;
    setConflictRevision(null);
    draftInitializedRef.current = true;
    setChargeDisposition(closeout?.chargeDisposition ?? "");
    setNoChargeReason(closeout?.noChargeReason ?? "");
    setHandoffMethod(closeout?.handoffMethod ?? "");
    hydratedRevision.current = key;
  }, [applyClinicalFields, closeout, data]);

  useEffect(() => {
    if (!data) return;
    const key = activeInvoice
      ? `${activeInvoice.id}:${activeInvoice.dueDate ?? "unscheduled"}`
      : "no-invoice";
    if (hydratedInvoice.current === key) return;
    setInvoiceDueDate(
      activeInvoice?.dueDate ?? defaultPayLaterDueDate(data.practice.timezone),
    );
    hydratedInvoice.current = key;
  }, [activeInvoice, data]);

  const refresh = async () => {
    await Promise.all([
      utils.encounters.getCloseout.invalidate({ appointmentId }),
      utils.appointments.getById.invalidate({ id: appointmentId }),
      utils.appointments.list.invalidate(),
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      }),
      utils.whiteboard.getActive.invalidate(),
    ]);
  };

  const saveDraft = trpc.encounters.saveDraft.useMutation();
  const saveDraftRef = useRef(saveDraft.mutateAsync);
  saveDraftRef.current = saveDraft.mutateAsync;
  const finalizeClinical = trpc.encounters.finalizeClinical.useMutation({
    onSuccess: async () => {
      conflictRef.current = false;
      setConflictRevision(null);
      setDraftSaveState("saved");
      toast.success(t("visit.clinicalHandoffFinalizedToast"));
      await refresh();
    },
    onError: async (error) => {
      if ((error as { data?: { code?: string } }).data?.code === "CONFLICT") {
        conflictRef.current = true;
        try {
          const latest = await utils.encounters.getCloseout.fetch({
            appointmentId,
          });
          setConflictRevision(latest.closeout?.revision ?? 0);
        } catch {
          setConflictRevision(null);
        }
        setDraftSaveState("conflict");
      }
      toast.error(error.message);
    },
  });
  const completeVisit = trpc.encounters.completeVisit.useMutation({
    onSuccess: async () => {
      toast.success(t("visit.visitCompletedToast"));
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const reopenClinical = trpc.encounters.reopenClinical.useMutation({
    onSuccess: async () => {
      toast.success(t("visit.amendmentStartedToast"));
      setAmendmentReason("");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const resolveNeededFollowUp =
    trpc.encounters.resolveNeededFollowUp.useMutation({
      onSuccess: async () => {
        toast.success(t("visit.followUpResolvedToast"));
        setFollowUpResolution("");
        setResolutionAppointmentId("");
        setResolutionNotes("");
        await refresh();
        await utils.encounters.listPendingFollowUps.invalidate();
      },
      onError: (error) => toast.error(error.message),
    });

  const canDraftClinical =
    role === "admin" || role === "veterinarian" || role === "technician";
  const canFinalizeClinical =
    role === "veterinarian" ||
    (role === "admin" &&
      (appointment.typeRequiresDoctor === 0 ||
        clinicalProfileQuery.data?.isVeterinarian === true)) ||
    (appointment.typeRequiresDoctor === 0 && role === "technician");
  const signedClinical =
    closeout?.status === "clinical_finalized" ||
    closeout?.status === "completed";
  const amendingClinical = Boolean(closeout?.amendmentDraft);
  const clinicalLocked = signedClinical && !amendingClinical;
  const isCompleted = closeout?.status === "completed";
  const persistCloseoutDraft = useCallback(async () => {
    if (!draftInitializedRef.current || clinicalLocked || !canDraftClinical) {
      return null;
    }
    while (true) {
      if (conflictRef.current) return null;
      if (!window.navigator.onLine) {
        setDraftSaveState("unsaved");
        return null;
      }
      if (savePromiseRef.current) {
        await savePromiseRef.current.catch(() => null);
        continue;
      }
      const fields = { ...fieldsRef.current };
      const fingerprint = clinicalDraftFingerprint(fields);
      if (fingerprint === lastSavedFingerprintRef.current) {
        return { revision: revisionRef.current };
      }
      setDraftSaveState("saving");
      const request = saveDraftRef.current({
        appointmentId,
        expectedRevision: revisionRef.current,
        diagnosisSummary: fields.diagnosisSummary || null,
        dischargeInstructions: fields.dischargeInstructions || null,
        warningSigns: fields.warningSigns || null,
        noInstructionsReason: fields.noInstructionsReason || null,
        prescriptionDisposition: fields.prescriptionDisposition || null,
        followUpDisposition: fields.followUpDisposition || null,
        followUpNotes: fields.followUpNotes || null,
        followUpAppointmentId: fields.followUpAppointmentId || null,
        followUpDueDate: fields.followUpDueDate || null,
        followUpAssignedTo: fields.followUpAssignedTo || null,
        documentationExceptionReason:
          fields.documentationExceptionReason || null,
      });
      savePromiseRef.current = request;
      try {
        const result = await request;
        revisionRef.current = result.revision;
        lastSavedFingerprintRef.current = fingerprint;
        setLastDraftSavedAt(result.updatedAt ?? new Date());
        setDraftSaveState("saved");
        await utils.encounters.getCloseout.invalidate({ appointmentId });
      } catch (error) {
        const code = (error as { data?: { code?: string } })?.data?.code;
        if (code === "CONFLICT") {
          conflictRef.current = true;
          try {
            const latest = await utils.encounters.getCloseout.fetch({
              appointmentId,
            });
            setConflictRevision(latest.closeout?.revision ?? 0);
          } catch {
            setConflictRevision(null);
          }
          setDraftSaveState("conflict");
          toast.error(
            t("visit.closeoutChangedToast"),
          );
        } else {
          setDraftSaveState("error");
          toast.error(
            error instanceof Error
              ? error.message
              : t("visit.closeoutDraftSaveError"),
          );
        }
        return null;
      } finally {
        if (savePromiseRef.current === request) savePromiseRef.current = null;
      }
    }
  }, [
    appointmentId,
    canDraftClinical,
    clinicalLocked,
    utils.encounters.getCloseout,
  ]);

  const closeoutNeedsLeaveGuard = useCallback(() => {
    if (!draftInitializedRef.current || clinicalLocked) return false;
    return (
      conflictRef.current ||
      savePromiseRef.current !== null ||
      clinicalDraftFingerprint(fieldsRef.current) !==
        lastSavedFingerprintRef.current
    );
  }, [clinicalLocked]);

  useEffect(() => {
    if (!draftInitializedRef.current || clinicalLocked || conflictRef.current) {
      return;
    }
    const fingerprint = clinicalDraftFingerprint(fieldsRef.current);
    if (fingerprint === lastSavedFingerprintRef.current) return;
    setDraftSaveState("unsaved");
    if (!isOnline) return;
    const timer = window.setTimeout(() => void persistCloseoutDraft(), 1_200);
    autosaveTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null;
    };
  }, [
    clinicalLocked,
    diagnosisSummary,
    dischargeInstructions,
    documentationExceptionReason,
    followUpAppointmentId,
    followUpAssignedTo,
    followUpDisposition,
    followUpDueDate,
    followUpNotes,
    isOnline,
    noInstructionsReason,
    persistCloseoutDraft,
    prescriptionDisposition,
    warningSigns,
  ]);

  useEffect(() => {
    if (!isOnline || conflictRef.current || !closeoutNeedsLeaveGuard()) return;
    void persistCloseoutDraft();
  }, [closeoutNeedsLeaveGuard, isOnline, persistCloseoutDraft]);

  useUnsavedChangesGuard(
    closeoutNeedsLeaveGuard(),
    t("visit.unsavedCloseoutLeaveConfirm"),
  );

  async function finalizeClinicalHandoff() {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const saved = await persistCloseoutDraft();
    if (!saved || conflictRef.current || !window.navigator.onLine) return;
    const fields = { ...fieldsRef.current };
    finalizeClinical.mutate({
      appointmentId,
      expectedRevision: revisionRef.current,
      diagnosisSummary: fields.diagnosisSummary || null,
      dischargeInstructions: fields.dischargeInstructions || null,
      warningSigns: fields.warningSigns || null,
      noInstructionsReason: fields.noInstructionsReason || null,
      prescriptionDisposition: fields.prescriptionDisposition || null,
      followUpDisposition: fields.followUpDisposition || null,
      followUpNotes: fields.followUpNotes || null,
      followUpAppointmentId: fields.followUpAppointmentId || null,
      followUpDueDate: fields.followUpDueDate || null,
      followUpAssignedTo: fields.followUpAssignedTo || null,
      documentationExceptionReason: fields.documentationExceptionReason || null,
    });
  }

  const fieldsFromPayload = (
    payload: NonNullable<CloseoutQueryState["data"]>,
  ): ClinicalDraftFields => {
    const source = payload.closeout?.amendmentDraft ?? payload.closeout;
    return {
      diagnosisSummary: source?.diagnosisSummary ?? "",
      dischargeInstructions: source?.dischargeInstructions ?? "",
      warningSigns: source?.warningSigns ?? "",
      noInstructionsReason: source?.noInstructionsReason ?? "",
      prescriptionDisposition: source?.prescriptionDisposition ?? "",
      followUpDisposition: source?.followUpDisposition ?? "",
      followUpNotes: source?.followUpNotes ?? "",
      followUpAppointmentId: source?.followUpAppointmentId ?? "",
      followUpDueDate: source?.followUpDueDate ?? "",
      followUpAssignedTo: source?.followUpAssignedTo ?? "",
      documentationExceptionReason: source?.documentationExceptionReason ?? "",
    };
  };

  async function useServerCloseoutDraft() {
    try {
      const latest = await utils.encounters.getCloseout.fetch({
        appointmentId,
      });
      const serverFields = fieldsFromPayload(latest);
      applyClinicalFields(serverFields);
      revisionRef.current = latest.closeout?.revision ?? 0;
      lastSavedFingerprintRef.current = clinicalDraftFingerprint(serverFields);
      setLastDraftSavedAt(latest.closeout?.updatedAt ?? null);
      conflictRef.current = false;
      setConflictRevision(null);
      setDraftSaveState(latest.closeout ? "saved" : "idle");
      await utils.encounters.getCloseout.invalidate({ appointmentId });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The server closeout could not be loaded",
      );
    }
  }

  async function overwriteServerCloseoutDraft() {
    if (!window.navigator.onLine) {
      toast.error(t("visit.reconnectBeforeReplace"));
      return;
    }
    try {
      const latest = await utils.encounters.getCloseout.fetch({
        appointmentId,
      });
      const serverFields = fieldsFromPayload(latest);
      revisionRef.current = latest.closeout?.revision ?? conflictRevision ?? 0;
      lastSavedFingerprintRef.current = clinicalDraftFingerprint(serverFields);
      conflictRef.current = false;
      setConflictRevision(null);
      setDraftSaveState("unsaved");
      await persistCloseoutDraft();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The local closeout could not replace the server draft",
      );
    }
  }
  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(" ");

  async function downloadDischarge() {
    if (!data || !signedClinical) return;
    try {
      const { generateDischargeInstructions } = await import("@/lib/pdf");
      const followUpDate = closeout?.followUpScheduledAt
        ? new Date(closeout.followUpScheduledAt).toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: data.practice.timezone ?? undefined,
          })
        : closeout?.followUpDisposition === "needed" && closeout.followUpDueDate
          ? `${t("visit.neededBy")} ${formatClinicDate(closeout.followUpDueDate, locale)}`
          : undefined;
      const instructions = closeout?.dischargeInstructions
        ? splitOwnerInstructions(closeout.dischargeInstructions)
        : closeout?.noInstructionsReason
          ? [
              `${t("visit.noAdditionalInstructions")} ${closeout.noInstructionsReason}`,
            ]
          : [];
      generateDischargeInstructions({
        practiceName: data.practice.name,
        practicePhone: data.practice.phone ?? undefined,
        patientName: appointment.patientName ?? t("visit.patient"),
        species: appointment.patientSpecies ?? "",
        clientName: clientName || t("visit.owner"),
        visitDate: formatAppointmentTime(
          appointment.startTime,
          data.practice.timezone,
          locale,
        ),
        doctorName: closeout?.clinicalFinalizerName ?? undefined,
        diagnosis: closeout?.diagnosisSummary ?? undefined,
        medications: (closeout?.medicationSnapshot ?? []).map((medication) => ({
          name: medication.medicationName,
          dosage: medication.dosage,
          frequency: medication.frequency,
          instructions: medication.instructions ?? undefined,
        })),
        instructions,
        followUpDate,
        followUpNotes: closeout?.followUpNotes ?? undefined,
        emergencyNotes: closeout?.warningSigns ?? undefined,
      }).save(
        `discharge_${(appointment.patientName ?? "patient").replace(/\s+/g, "_")}.pdf`,
      );
      toast.success(t("visit.dischargeDownloaded"));
    } catch {
      toast.error(t("visit.dischargeGenerateError"));
    }
  }

  type HistoricalCloseout = NonNullable<
    typeof closeout
  >["amendmentHistory"][number];

  async function downloadHistoricalDischarge(amendment: HistoricalCloseout) {
    if (!data) return;
    try {
      const { generateDischargeInstructions } = await import("@/lib/pdf");
      const followUpDate = amendment.followUpScheduledAt
        ? new Date(amendment.followUpScheduledAt).toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: data.practice.timezone ?? undefined,
          })
        : amendment.followUpDisposition === "needed" &&
            amendment.followUpDueDate
          ? `${t("visit.neededBy")} ${formatClinicDate(amendment.followUpDueDate, locale)}`
          : undefined;
      const instructions = amendment.dischargeInstructions
        ? splitOwnerInstructions(amendment.dischargeInstructions)
        : amendment.noInstructionsReason
          ? [
              `${t("visit.noAdditionalInstructions")} ${amendment.noInstructionsReason}`,
            ]
          : [];
      generateDischargeInstructions({
        practiceName: data.practice.name,
        practicePhone: data.practice.phone ?? undefined,
        patientName: appointment.patientName ?? t("visit.patient"),
        species: appointment.patientSpecies ?? "",
        clientName: clientName || t("visit.owner"),
        visitDate: formatAppointmentTime(
          appointment.startTime,
          data.practice.timezone,
          locale,
        ),
        doctorName: amendment.clinicalFinalizerName,
        diagnosis: amendment.diagnosisSummary ?? undefined,
        medications: amendment.medicationSnapshot.map((medication) => ({
          name: medication.medicationName,
          dosage: medication.dosage,
          frequency: medication.frequency,
          instructions: medication.instructions ?? undefined,
        })),
        instructions,
        followUpDate,
        followUpNotes: amendment.followUpNotes ?? undefined,
        emergencyNotes: amendment.warningSigns ?? undefined,
      }).save(
        `discharge_${(appointment.patientName ?? "patient").replace(/\s+/g, "_")}_revision_${amendment.priorRevision}.pdf`,
      );
      toast.success(`${t("visit.dischargeRevisionDownloaded")} ${amendment.priorRevision}`);
    } catch {
      toast.error(t("visit.priorDischargeGenerateError"));
    }
  }

  if (closeoutQuery.isLoading) {
    return (
      <Card id="visit-closeout">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("visit.loadingCloseout")}
        </CardContent>
      </Card>
    );
  }
  if (closeoutQuery.error || !data) {
    return (
      <Card id="visit-closeout" className="border-destructive">
        <CardHeader>
          <CardTitle>{t("visit.closeoutUnavailable")}</CardTitle>
          <CardDescription className="text-destructive">
            {closeoutQuery.error?.message ??
              t("visit.readinessError")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="visit-closeout" className="scroll-mt-4" tabIndex={-1}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("visit.closeout")}</CardTitle>
            <CardDescription>
              {t("visit.closeoutDescription")}
            </CardDescription>
          </div>
          <Badge variant={isCompleted ? "success" : "outline"}>
            {amendingClinical
              ? isCompleted
                ? `${t("visit.completed")} · ${t("visit.amendmentDraft")}`
                : `${t("clinicalRecords.status.finalized")} · ${t("visit.amendmentDraft")}`
              : isCompleted
                ? t("visit.completed")
                : clinicalLocked
                  ? t("visit.clinicalHandoffFinalized")
                  : closeout
                    ? t("clinicalRecords.status.draft")
                    : t("visit.notStarted")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadinessTile
            label={t("visit.clinicalNote")}
            value={
              data.soapDraft
                ? `${t("visit.draftInProgress")} · ${t("visit.revision")} ${data.soapDraft.revision}`
                : data.linkedSoapCount > 0
                  ? `${data.linkedSoapCount} ${t("visit.linkedSoapNotes")}`
                  : closeout?.documentationExceptionReason
                    ? t("visit.documentedException")
                    : data.missingSoapReplacement
                      ? t("visit.replacementOrExceptionNeeded")
                      : t("visit.missing")
            }
          />
          <ReadinessTile
            label={t("visit.visitMedications")}
            value={
              data.activeMedications.length > 0
                ? `${data.activeMedications.length} ${t("visit.activeLinkedPrescriptions")}`
                : t("visit.noneLinked")
            }
          />
          <ReadinessTile
            label={t("visit.billing")}
            value={
              activeInvoice
                ? `${invoiceStatusLabel(activeInvoice.status, t)} · ${activeInvoice.itemCount} ${t("visit.invoiceLines")}`
                : t("visit.noActiveInvoice")
            }
          />
        </div>

        {!clinicalLocked ? (
          appointment.status !== "in_exam" && !amendingClinical ? (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t("visit.startBeforeCloseout")}
            </div>
          ) : canDraftClinical ? (
            <ClinicalCloseoutForm
              diagnosisSummary={diagnosisSummary}
              setDiagnosisSummary={setDiagnosisSummary}
              dischargeInstructions={dischargeInstructions}
              setDischargeInstructions={setDischargeInstructions}
              warningSigns={warningSigns}
              setWarningSigns={setWarningSigns}
              noInstructionsReason={noInstructionsReason}
              setNoInstructionsReason={setNoInstructionsReason}
              prescriptionDisposition={prescriptionDisposition}
              setPrescriptionDisposition={setPrescriptionDisposition}
              followUpDisposition={followUpDisposition}
              setFollowUpDisposition={setFollowUpDisposition}
              followUpNotes={followUpNotes}
              setFollowUpNotes={setFollowUpNotes}
              followUpAppointmentId={followUpAppointmentId}
              setFollowUpAppointmentId={setFollowUpAppointmentId}
              followUpDueDate={followUpDueDate}
              setFollowUpDueDate={setFollowUpDueDate}
              followUpAssignedTo={followUpAssignedTo}
              setFollowUpAssignedTo={setFollowUpAssignedTo}
              documentationExceptionReason={documentationExceptionReason}
              setDocumentationExceptionReason={setDocumentationExceptionReason}
              linkedSoapCount={data.linkedSoapCount}
              missingSoapReplacement={data.missingSoapReplacement}
              soapReplacementHref={
                data.missingSoapReplacement
                  ? `/records/replace-soap/${appointment.patientId}?sourceNoteId=${data.missingSoapReplacement.sourceNoteId}&return=patient`
                  : null
              }
              soapDraft={data.soapDraft}
              soapDraftHref={`/records/new-soap/${appointment.patientId}?appointmentId=${appointmentId}`}
              linkedMedicationCount={data.activeMedications.length}
               followUpAppointments={data.followUpAppointments}
               followUpAssignees={data.followUpAssignees}
               locale={locale}
               timeZone={data.practice.timezone}
              isAmendment={amendingClinical}
              saveState={draftSaveState}
              lastSavedAt={lastDraftSavedAt}
              isOnline={isOnline}
              isSaving={saveDraft.isPending || finalizeClinical.isPending}
              isFinalizing={finalizeClinical.isPending}
              canFinalize={canFinalizeClinical}
              onSave={() => void persistCloseoutDraft()}
              onUseServer={() => void useServerCloseoutDraft()}
              onOverwrite={() => void overwriteServerCloseoutDraft()}
              onFinalize={() => void finalizeClinicalHandoff()}
            />
          ) : (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {t("visit.roleCannotPrepareCloseout")}
            </div>
          )
        ) : null}

        {signedClinical ? (
          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-medium">1. {t("visit.clinicalHandoffFinalized")}</h3>
                <p className="text-sm text-muted-foreground">
                  {closeout?.medicationSnapshot.length ?? 0} {t("visit.visitMedications")} · {closeout?.followUpDisposition ? t("visit.followUp") : t("visit.noneNeeded")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadDischarge}>
                <Download className="mr-2 h-4 w-4" />
                {t("visit.downloadDischarge")}
              </Button>
            </div>
            <dl className="grid gap-3 rounded-md border border-border bg-background p-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("visit.finalizedBy")}
                </dt>
                <dd className="mt-1">
                  {closeout?.clinicalFinalizerName ?? t("visit.unknownClinician")}
                  {closeout?.clinicalFinalizedAt
                    ? ` · ${formatAppointmentTime(
                        closeout.clinicalFinalizedAt,
                        data.practice.timezone,
                        locale,
                      )}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("visit.followUp")}
                </dt>
                <dd className="mt-1">
                  {closeout?.followUpDisposition === "scheduled" &&
                  closeout.followUpScheduledAt
                    ? `${t("visit.scheduled")} ${formatAppointmentTime(
                        closeout.followUpScheduledAt,
                        data.practice.timezone,
                        locale,
                      )}`
                    : closeout?.followUpDisposition === "needed" &&
                        closeout.followUpDueDate
                      ? `${t("visit.neededBy")} ${formatClinicDate(closeout.followUpDueDate, locale)} · ${t("visit.assignedTo")} ${closeout.followUpAssigneeName ?? t("visit.clinicTeam")}`
                      : t("visit.noFollowUpNeeded")}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("visit.diagnosisSummary")}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap">
                  {closeout?.diagnosisSummary || t("visit.notRecorded")}
                </dd>
              </div>
            </dl>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t("visit.medications")}</h4>
              {closeout?.medicationSnapshot.length ? (
                <ul className="space-y-2">
                  {closeout.medicationSnapshot.map((medication) => (
                    <li
                      key={medication.prescriptionId}
                      className="rounded-md border border-border bg-background p-3 text-sm"
                    >
                      <p className="font-medium">{medication.medicationName}</p>
                      <p className="text-muted-foreground">
                        {medication.dosage} · {medication.frequency}
                        {medication.quantity
                          ? ` · ${t("visit.quantity")} ${medication.quantity}`
                          : ""}
                      </p>
                      {medication.instructions ? (
                        <p className="mt-1 whitespace-pre-wrap">
                          {medication.instructions}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("visit.noVisitMedications")}
                </p>
              )}
            </div>
            <div className="space-y-3 rounded-md border border-border bg-background p-3 text-sm">
              <div>
                <h4 className="font-medium">{t("visit.homeCare")}</h4>
                {closeout?.dischargeInstructions ? (
                  <p className="mt-1 whitespace-pre-wrap">
                    {closeout.dischargeInstructions}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    {t("visit.noAdditionalInstructions")} {closeout?.noInstructionsReason}
                  </p>
                )}
              </div>
              {closeout?.warningSigns ? (
                <div>
                  <h4 className="font-medium">
                    {t("visit.warningSigns")}
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap">
                    {closeout.warningSigns}
                  </p>
                </div>
              ) : null}
              {closeout?.followUpNotes ? (
                <div>
                  <h4 className="font-medium">{t("visit.followUpNotes")}</h4>
                  <p className="mt-1 whitespace-pre-wrap">
                    {closeout.followUpNotes}
                  </p>
                </div>
              ) : null}
            </div>
            {closeout?.amendmentHistory.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("visit.priorFinalizedVersions").replace("{count}", String(closeout.amendmentHistory.length))}
                </p>
                {closeout.amendmentHistory.map((amendment) => (
                  <details
                    key={`${amendment.priorRevision}:${amendment.reopenedAt}`}
                    className="rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <summary className="cursor-pointer font-medium">
                      {t("visit.revision")} {amendment.priorRevision} · {amendment.reason}
                    </summary>
                    <div className="mt-3 space-y-2 text-muted-foreground">
                      <p>
                        {t("visit.finalizedBy")} {amendment.clinicalFinalizerName} ·{" "}
                        {formatAppointmentTime(
                          amendment.clinicalFinalizedAt,
                          data.practice.timezone,
                          locale,
                        )}
                        · {t("visit.correctionOpenedBy")} {amendment.reopenedByName} ·{" "}
                        {formatAppointmentTime(
                          amendment.reopenedAt,
                          data.practice.timezone,
                          locale,
                        )}
                        .
                      </p>
                      <p className="whitespace-pre-wrap">
                        {amendment.dischargeInstructions ||
                          `No additional instructions: ${amendment.noInstructionsReason}`}
                      </p>
                      {amendment.diagnosisSummary ? (
                        <p className="whitespace-pre-wrap">
                          <span className="font-medium text-foreground">
                            {t("visit.visitSummary")}{" "}
                          </span>
                          {amendment.diagnosisSummary}
                        </p>
                      ) : null}
                      {amendment.warningSigns ? (
                        <p className="whitespace-pre-wrap">
                          <span className="font-medium text-foreground">
                            {t("visit.warningSigns")}: {" "}
                          </span>
                          {amendment.warningSigns}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-medium text-foreground">
                          {t("visit.followUp")}: {" "}
                        </span>
                        {amendment.followUpDisposition === "scheduled" &&
                        amendment.followUpScheduledAt
                          ? formatAppointmentTime(
                              amendment.followUpScheduledAt,
                              data.practice.timezone,
                            )
                          : amendment.followUpDisposition === "needed" &&
                              amendment.followUpDueDate
                            ? `${t("visit.neededBy")} ${formatClinicDate(amendment.followUpDueDate, locale)} · ${t("visit.assignedTo")} ${amendment.followUpAssigneeName ?? t("visit.clinicTeam")}`
                            : t("visit.noneNeeded")}
                        {amendment.followUpNotes
                          ? ` · ${amendment.followUpNotes}`
                          : ""}
                      </p>
                      {amendment.medicationSnapshot.length ? (
                        <ul className="list-disc pl-5">
                          {amendment.medicationSnapshot.map((medication) => (
                            <li key={medication.prescriptionId}>
                              {medication.medicationName} · {medication.dosage}{" "}
                              · {medication.frequency}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadHistoricalDischarge(amendment)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t("visit.downloadRevision")} {amendment.priorRevision}
                      </Button>
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
            {(role === "admin" || role === "veterinarian") &&
            !amendingClinical ? (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
                <label
                  className="text-sm font-medium"
                  htmlFor="closeout-amendment-reason"
                >
                  {t("visit.createAttributedCorrection")}
                </label>
                <Input
                  id="closeout-amendment-reason"
                  value={amendmentReason}
                  onChange={(event) => setAmendmentReason(event.target.value)}
                  placeholder={t("visit.correctionReasonPlaceholder")}
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      amendmentReason.trim().length < 5 ||
                      reopenClinical.isPending
                    }
                    onClick={() =>
                      reopenClinical.mutate({
                        appointmentId,
                        expectedRevision: closeout!.revision,
                        reason: amendmentReason,
                      })
                    }
                  >
                    {reopenClinical.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t("visit.startAmendment")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {signedClinical && closeout?.followUpDisposition === "needed" ? (
          <FollowUpResolutionPanel
            dueDate={closeout.followUpDueDate}
            assigneeName={closeout.followUpAssigneeName}
            resolution={closeout.followUpResolution}
            resolutionNotes={closeout.followUpResolutionNotes}
            resolutionScheduledAt={closeout.followUpResolutionScheduledAt}
            resolvedAt={closeout.followUpResolvedAt}
            resolverName={closeout.followUpResolverName}
            selectedResolution={followUpResolution}
            setSelectedResolution={setFollowUpResolution}
            resolutionAppointmentId={resolutionAppointmentId}
            setResolutionAppointmentId={setResolutionAppointmentId}
            notes={resolutionNotes}
            setNotes={setResolutionNotes}
            followUpAppointments={data.followUpAppointments}
            timeZone={data.practice.timezone}
            canResolve={canManageVisit(role)}
            isPending={resolveNeededFollowUp.isPending}
            onResolve={() => {
              if (!followUpResolution || !closeout) return;
              resolveNeededFollowUp.mutate({
                appointmentId,
                expectedRevision: closeout.revision,
                resolution: followUpResolution,
                resolutionAppointmentId:
                  followUpResolution === "scheduled"
                    ? resolutionAppointmentId || null
                    : null,
                notes: resolutionNotes || null,
              });
            }}
          />
        ) : null}

        {clinicalLocked && !isCompleted && canManageVisit(role) ? (
          <OperationalCloseoutForm
            activeInvoice={activeInvoice}
            chargeDisposition={chargeDisposition}
            setChargeDisposition={setChargeDisposition}
            invoiceDueDate={invoiceDueDate}
            setInvoiceDueDate={setInvoiceDueDate}
            minimumDueDate={formatDateInputForTimeZone(
              new Date(),
              data.practice.timezone,
            )}
            noChargeReason={noChargeReason}
            setNoChargeReason={setNoChargeReason}
            handoffMethod={handoffMethod}
            setHandoffMethod={setHandoffMethod}
            isPending={completeVisit.isPending || invoicesQuery.isLoading}
            onDownload={downloadDischarge}
            onComplete={() => {
              if (!chargeDisposition || !handoffMethod || !closeout) return;
              completeVisit.mutate({
                appointmentId,
                expectedRevision: closeout.revision,
                chargeDisposition,
                noChargeReason:
                  chargeDisposition === "no_charge"
                    ? noChargeReason || null
                    : null,
                invoiceDueDate:
                  chargeDisposition === "accounts_receivable"
                    ? invoiceDueDate
                    : null,
                handoffMethod,
              });
            }}
          />
        ) : null}

        {isCompleted ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            <p className="font-medium">
              {t("visit.visitCompleted")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("visit.billingSummary")} {chargeDispositionLabel(closeout?.chargeDisposition, t)} · {t("visit.ownerHandoffSummary")} {handoffMethodLabel(closeout?.handoffMethod, t)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadinessTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

type ClinicalCloseoutFormProps = {
  diagnosisSummary: string;
  setDiagnosisSummary: (value: string) => void;
  dischargeInstructions: string;
  setDischargeInstructions: (value: string) => void;
  warningSigns: string;
  setWarningSigns: (value: string) => void;
  noInstructionsReason: string;
  setNoInstructionsReason: (value: string) => void;
  prescriptionDisposition: "" | "prescribed" | "not_needed";
  setPrescriptionDisposition: (value: "" | "prescribed" | "not_needed") => void;
  followUpDisposition: "" | "none" | "needed" | "scheduled";
  setFollowUpDisposition: (value: "" | "none" | "needed" | "scheduled") => void;
  followUpNotes: string;
  setFollowUpNotes: (value: string) => void;
  followUpAppointmentId: string;
  setFollowUpAppointmentId: (value: string) => void;
  followUpDueDate: string;
  setFollowUpDueDate: (value: string) => void;
  followUpAssignedTo: string;
  setFollowUpAssignedTo: (value: string) => void;
  documentationExceptionReason: string;
  setDocumentationExceptionReason: (value: string) => void;
  linkedSoapCount: number;
  missingSoapReplacement: { sourceNoteId: string } | null;
  soapReplacementHref: string | null;
  soapDraft: {
    revision: number;
    authorName: string;
    updatedAt: Date | string;
  } | null;
  soapDraftHref: string;
  linkedMedicationCount: number;
  followUpAppointments: Array<{ id: string; startTime: Date | string }>;
  followUpAssignees: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
  locale: string;
  timeZone?: string | null;
  isAmendment: boolean;
  saveState: "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict";
  lastSavedAt: Date | null;
  isOnline: boolean;
  isSaving: boolean;
  isFinalizing: boolean;
  canFinalize: boolean;
  onSave: () => void;
  onUseServer: () => void;
  onOverwrite: () => void;
  onFinalize: () => void;
};

function ClinicalCloseoutForm(props: ClinicalCloseoutFormProps) {
  const t = useTranslations();
  const finalizationIssues = [
    props.soapDraft
      ? t("visit.finalizeOrDiscardSoap")
      : null,
    !props.dischargeInstructions.trim() && !props.noInstructionsReason.trim()
      ? t("visit.enterHomeCareOrReason")
      : null,
    !props.prescriptionDisposition
      ? t("visit.confirmPrescriptionDisposition")
      : props.linkedMedicationCount > 0 &&
          props.prescriptionDisposition !== "prescribed"
        ? t("visit.linkedPrescriptionsHandoff")
        : props.linkedMedicationCount === 0 &&
            props.prescriptionDisposition !== "not_needed"
          ? t("visit.noActivePrescription")
          : null,
    !props.followUpDisposition
      ? t("visit.chooseFollowUpDisposition")
      : props.followUpDisposition === "scheduled" &&
          !props.followUpAppointmentId
        ? t("visit.chooseScheduledAppointment")
        : props.followUpDisposition === "needed" && !props.followUpDueDate
          ? t("visit.setFollowUpDate")
          : props.followUpDisposition === "needed" && !props.followUpAssignedTo
            ? t("visit.assignFollowUpOwner")
            : null,
    props.linkedSoapCount === 0 && !props.documentationExceptionReason.trim()
      ? t("visit.linkSoapOrReason")
      : null,
  ].filter((issue): issue is string => Boolean(issue));
  const canFinalizeNow =
    props.canFinalize &&
    props.isOnline &&
    props.saveState !== "conflict" &&
    finalizationIssues.length === 0 &&
    !props.isSaving;
  const saveStatus = !props.isOnline
    ? t("visit.changesOnlyDevice")
    : props.saveState === "saving"
      ? t("visit.savingCloseout")
      : props.saveState === "saved"
        ? `${t("visit.savedToServer")}${
            props.lastSavedAt
               ? ` at ${props.lastSavedAt.toLocaleTimeString(props.locale, {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : ""
          }.`
        : props.saveState === "error"
          ? t("visit.closeoutSaveFailed")
          : props.saveState === "conflict"
            ? t("visit.closeoutConflict")
            : props.saveState === "unsaved"
              ? t("visit.changesNotSaved")
              : t("visit.serverDraftRecoveryReady");

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div>
        <h3 className="font-medium">
          1. {t("visit.clinicalOwnerHandoff")}{props.isAmendment ? ` ${t("visit.amendment")}` : ""}
        </h3>
        <p className="text-sm text-muted-foreground">
          {props.isAmendment
            ? t("visit.currentSignedDischargeActive")
            : t("visit.finalizedContentDurable")}
        </p>
      </div>
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          !props.isOnline || props.saveState === "error"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
            : props.saveState === "conflict"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted/20 text-muted-foreground"
        }`}
        role="status"
        aria-live="polite"
      >
        {saveStatus}
      </div>
      {props.saveState === "conflict" ? (
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium">{t("visit.chooseCloseoutToKeep")}</p>
          <p className="text-xs text-muted-foreground">
            {t("visit.closeoutConflictDescription")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={props.onUseServer}
            >
              {t("visit.useServerVersion")}
            </Button>
            <Button type="button" size="sm" onClick={props.onOverwrite}>
              {t("visit.overwriteServerVersion")}
            </Button>
          </div>
        </div>
      ) : null}
      <div>
        <label className="text-sm font-medium" htmlFor="closeout-diagnosis">
          {t("visit.diagnosis")} {" "}
          <span className="text-muted-foreground">{t("visit.optional")}</span>
        </label>
        <Textarea
          id="closeout-diagnosis"
          value={props.diagnosisSummary}
          onChange={(event) => props.setDiagnosisSummary(event.target.value)}
          rows={3}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="closeout-instructions">
          {t("visit.homeCareInstructions")} <span aria-hidden="true">*</span>
        </label>
        <Textarea
          id="closeout-instructions"
          value={props.dischargeInstructions}
          onChange={(event) => {
            props.setDischargeInstructions(event.target.value);
            if (event.target.value) props.setNoInstructionsReason("");
          }}
          rows={5}
          className="mt-1"
          placeholder={t("visit.homeCarePlaceholder")}
        />
      </div>
      <div>
        <label
          className="text-sm font-medium"
          htmlFor="closeout-no-instructions"
        >
          {t("visit.noInstructionsReason")} <span aria-hidden="true">*</span>
        </label>
        <Input
          id="closeout-no-instructions"
          value={props.noInstructionsReason}
          onChange={(event) => {
            props.setNoInstructionsReason(event.target.value);
            if (event.target.value) props.setDischargeInstructions("");
          }}
          className="mt-1"
          placeholder={t("visit.noInstructionsPlaceholder")}
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="closeout-warning-signs">
          {t("visit.warningSignsField")} {" "}
          <span className="text-muted-foreground">{t("visit.optional")}</span>
        </label>
        <Textarea
          id="closeout-warning-signs"
          value={props.warningSigns}
          onChange={(event) => props.setWarningSigns(event.target.value)}
          rows={3}
          className="mt-1"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-prescriptions"
          >
            {t("visit.prescriptions")} <span aria-hidden="true">*</span>
          </label>
          <select
            id="closeout-prescriptions"
            value={props.prescriptionDisposition}
            onChange={(event) =>
              props.setPrescriptionDisposition(
                event.target.value as typeof props.prescriptionDisposition,
              )
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("visit.choose")}</option>
            <option
              value="prescribed"
              disabled={props.linkedMedicationCount === 0}
            >
              {t("visit.prescriptionCreated")}
            </option>
            <option
              value="not_needed"
              disabled={props.linkedMedicationCount > 0}
            >
              {t("visit.noPrescriptionNeeded")}
            </option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="closeout-follow-up">
            {t("visit.followUp")} <span aria-hidden="true">*</span>
          </label>
          <select
            id="closeout-follow-up"
            value={props.followUpDisposition}
            onChange={(event) => {
              const next = event.target
                .value as typeof props.followUpDisposition;
              props.setFollowUpDisposition(next);
              if (next !== "scheduled") props.setFollowUpAppointmentId("");
              if (next !== "needed") {
                props.setFollowUpDueDate("");
                props.setFollowUpAssignedTo("");
              }
            }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("visit.choose")}</option>
            <option value="none">{t("visit.noFollowUp")}</option>
            <option value="needed">{t("visit.followUpNeededNotScheduled")}</option>
            <option value="scheduled">{t("visit.alreadyScheduled")}</option>
          </select>
        </div>
      </div>
      {props.followUpDisposition === "scheduled" ? (
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-follow-up-appointment"
          >
            {t("visit.scheduledFollowUp")}
          </label>
          <select
            id="closeout-follow-up-appointment"
            value={props.followUpAppointmentId}
            onChange={(event) =>
              props.setFollowUpAppointmentId(event.target.value)
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("visit.choose")}</option>
            {props.followUpAppointments.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {formatAppointmentTime(candidate.startTime, props.timeZone, props.locale)}
              </option>
            ))}
          </select>
          {props.followUpAppointments.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("visit.noFutureAppointment")}
            </p>
          ) : null}
        </div>
      ) : null}
      {props.followUpDisposition === "needed" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              className="text-sm font-medium"
              htmlFor="closeout-follow-up-due-date"
            >
              {t("visit.followUpDueDate")} <span aria-hidden="true">*</span>
            </label>
            <Input
              id="closeout-follow-up-due-date"
              type="date"
              value={props.followUpDueDate}
              onChange={(event) => props.setFollowUpDueDate(event.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label
              className="text-sm font-medium"
              htmlFor="closeout-follow-up-assignee"
            >
              {t("visit.followUpOwner")} <span aria-hidden="true">*</span>
            </label>
            <select
              id="closeout-follow-up-assignee"
              value={props.followUpAssignedTo}
              onChange={(event) =>
                props.setFollowUpAssignedTo(event.target.value)
              }
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("visit.choose")}</option>
              {props.followUpAssignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name || assignee.email} ·{" "}
                  {roleLabel(assignee.role, t)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {props.followUpDisposition && props.followUpDisposition !== "none" ? (
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-follow-up-notes"
          >
            {t("visit.followUpNotes")} {" "}
            <span className="text-muted-foreground">{t("visit.optional")}</span>
          </label>
          <Textarea
            id="closeout-follow-up-notes"
            value={props.followUpNotes}
            onChange={(event) => props.setFollowUpNotes(event.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>
      ) : null}
      {props.soapDraft ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">{t("visit.soapDraftInProgress")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("visit.soapDraftDescription")} ({t("visit.revision")} {props.soapDraft.revision}).
          </p>
          <Button className="mt-3" size="sm" variant="outline" asChild>
            <a href={props.soapDraftHref}>
              <FileText className="mr-2 h-4 w-4" />
              {t("visit.resumeSoapDraft")}
            </a>
          </Button>
        </div>
      ) : props.missingSoapReplacement ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">{t("visit.signedSoapVoided")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("visit.signedSoapVoidedDescription")}
          </p>
          <Button className="mt-3" size="sm" asChild>
            <Link href={props.soapReplacementHref ?? props.soapDraftHref}>
              <FileText className="mr-2 h-4 w-4" />
              {t("visit.createReplacementSoap")}
            </Link>
          </Button>
          <Input
            aria-label={t("visit.documentationException")}
            value={props.documentationExceptionReason}
            onChange={(event) =>
              props.setDocumentationExceptionReason(event.target.value)
            }
            className="mt-3"
            placeholder={t("visit.replacementReasonPlaceholder")}
          />
        </div>
      ) : props.linkedSoapCount === 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">{t("visit.noSoapLinked")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("visit.noSoapLinkedDescription")}
          </p>
          <Input
            aria-label={t("visit.documentationException")}
            value={props.documentationExceptionReason}
            onChange={(event) =>
              props.setDocumentationExceptionReason(event.target.value)
            }
            className="mt-2"
            placeholder={t("visit.soapNotRequiredPlaceholder")}
          />
        </div>
      ) : null}
      {finalizationIssues.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
          role="status"
        >
          <p className="text-sm font-medium">{t("visit.beforeFinalizing")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {finalizationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={
            props.isSaving || !props.isOnline || props.saveState === "conflict"
          }
          onClick={props.onSave}
        >
          <Save className="mr-2 h-4 w-4" />
          {t("visit.saveDraft")}
        </Button>
        <Button disabled={!canFinalizeNow} onClick={props.onFinalize}>
          {props.isFinalizing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCheck className="mr-2 h-4 w-4" />
          )}
          {t("visit.finalizeHandoff")}
        </Button>
      </div>
      {!props.canFinalize ? (
        <p className="text-right text-xs text-muted-foreground">
          {t("visit.vetRequiredForCloseout")}
        </p>
      ) : null}
    </div>
  );
}

function FollowUpResolutionPanel({
  dueDate,
  assigneeName,
  resolution,
  resolutionNotes,
  resolutionScheduledAt,
  resolvedAt,
  resolverName,
  selectedResolution,
  setSelectedResolution,
  resolutionAppointmentId,
  setResolutionAppointmentId,
  notes,
  setNotes,
  followUpAppointments,
  timeZone,
  canResolve,
  isPending,
  onResolve,
}: {
  dueDate: string | null;
  assigneeName: string | null;
  resolution: "scheduled" | "completed" | "not_needed" | null;
  resolutionNotes: string | null;
  resolutionScheduledAt: Date | string | null;
  resolvedAt: Date | string | null;
  resolverName: string | null;
  selectedResolution: "" | "scheduled" | "completed" | "not_needed";
  setSelectedResolution: (
    value: "" | "scheduled" | "completed" | "not_needed",
  ) => void;
  resolutionAppointmentId: string;
  setResolutionAppointmentId: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  followUpAppointments: Array<{ id: string; startTime: Date | string }>;
  timeZone?: string | null;
  canResolve: boolean;
  isPending: boolean;
  onResolve: () => void;
}) {
  const t = useTranslations();
  const locale = useLanguage() === "es" ? "es-CR" : "en-US";
  const ready = Boolean(
    selectedResolution &&
    (selectedResolution === "scheduled"
      ? resolutionAppointmentId
      : notes.trim()),
  );

  return (
    <div className="space-y-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <div>
        <h3 className="font-medium">{t("visit.followUpObligation")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("visit.due")} {dueDate ? formatClinicDate(dueDate, locale) : t("visit.dateUnavailable")} · {t("visit.assignedTo")} {assigneeName ?? t("visit.clinicTeam")}. {t("visit.followUpAuditDescription")}
        </p>
      </div>
      {resolvedAt && resolution ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <p className="font-medium">
            {t("visit.resolvedAs")} {resolution === "scheduled" ? t("visit.scheduled") : resolution === "completed" ? t("visit.completed") : t("visit.clinicallyNotNeeded")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {resolverName ?? t("visit.clinicStaff")} ·{" "}
            {formatAppointmentTime(resolvedAt, timeZone, locale)}
            {resolutionScheduledAt
              ? ` · ${t("visit.scheduledAt")} ${formatAppointmentTime(
                  resolutionScheduledAt,
                  timeZone,
                  locale,
                  )}`
              : ""}
          </p>
          {resolutionNotes ? (
            <p className="mt-2 whitespace-pre-wrap">{resolutionNotes}</p>
          ) : null}
        </div>
      ) : canResolve ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium"
                htmlFor="closeout-follow-up-resolution"
              >
                {t("visit.followUpResolution")}
              </label>
              <select
                id="closeout-follow-up-resolution"
                value={selectedResolution}
                onChange={(event) => {
                  const next = event.target.value as typeof selectedResolution;
                  setSelectedResolution(next);
                  if (next !== "scheduled") setResolutionAppointmentId("");
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("visit.choose")}</option>
                <option value="scheduled">{t("visit.followUpScheduled")}</option>
                <option value="completed">
                  {t("visit.followUpCompletedAnotherWay")}
                </option>
                <option value="not_needed">{t("visit.clinicallyNotNeeded")}</option>
              </select>
            </div>
            {selectedResolution === "scheduled" ? (
              <div>
                <label
                  className="text-sm font-medium"
                  htmlFor="closeout-resolution-appointment"
                >
                  {t("visit.scheduledFollowUp")}
                </label>
                <select
                  id="closeout-resolution-appointment"
                  value={resolutionAppointmentId}
                  onChange={(event) =>
                    setResolutionAppointmentId(event.target.value)
                  }
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t("visit.choose")}</option>
                  {followUpAppointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {formatAppointmentTime(appointment.startTime, timeZone, locale)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          {selectedResolution && selectedResolution !== "scheduled" ? (
            <div>
              <label
                className="text-sm font-medium"
                htmlFor="closeout-resolution-notes"
              >
                {t("visit.resolutionNotes")}
              </label>
              <Textarea
                id="closeout-resolution-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1"
                placeholder={t("visit.resolutionNotesPlaceholder")}
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button disabled={!ready || isPending} onClick={onResolve}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {t("visit.resolveFollowUp")}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("visit.staffMustResolveFollowUp")}
        </p>
      )}
    </div>
  );
}

function OperationalCloseoutForm({
  activeInvoice,
  chargeDisposition,
  setChargeDisposition,
  invoiceDueDate,
  setInvoiceDueDate,
  minimumDueDate,
  noChargeReason,
  setNoChargeReason,
  handoffMethod,
  setHandoffMethod,
  isPending,
  onDownload,
  onComplete,
}: {
  activeInvoice: {
    id: string;
    status: string;
    itemCount: number;
    balanceDueCents: number;
    dueDate: Date | string | null;
  } | null;
  chargeDisposition: "" | "paid" | "accounts_receivable" | "no_charge";
  setChargeDisposition: (
    value: "" | "paid" | "accounts_receivable" | "no_charge",
  ) => void;
  invoiceDueDate: string;
  setInvoiceDueDate: (value: string) => void;
  minimumDueDate: string;
  noChargeReason: string;
  setNoChargeReason: (value: string) => void;
  handoffMethod: "" | "print" | "verbal" | "declined";
  setHandoffMethod: (value: "" | "print" | "verbal" | "declined") => void;
  isPending: boolean;
  onDownload: () => void;
  onComplete: () => void;
}) {
  const t = useTranslations();
  const paidReady = Boolean(
    activeInvoice &&
    activeInvoice.itemCount > 0 &&
    activeInvoice.status === "paid" &&
    activeInvoice.balanceDueCents === 0,
  );
  const accountsReceivableReady = Boolean(
    activeInvoice &&
    activeInvoice.itemCount > 0 &&
    ["draft", "sent", "overdue"].includes(activeInvoice.status) &&
    invoiceDueDate &&
    invoiceDueDate >= minimumDueDate &&
    activeInvoice.balanceDueCents > 0,
  );
  const noChargeReady = !activeInvoice;
  const selectedDispositionReady =
    (chargeDisposition === "paid" && paidReady) ||
    (chargeDisposition === "accounts_receivable" && accountsReceivableReady) ||
    (chargeDisposition === "no_charge" &&
      noChargeReady &&
      noChargeReason.trim().length > 0);
  const canComplete =
    selectedDispositionReady && Boolean(handoffMethod) && !isPending;

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div>
        <h3 className="font-medium">2. {t("visit.billingAndHandoff")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("visit.billingHandoffDescription")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-medium"
            htmlFor="closeout-charge-state"
          >
            {t("visit.billingDisposition")}
          </label>
          <select
            id="closeout-charge-state"
            value={chargeDisposition}
            onChange={(event) =>
              setChargeDisposition(
                event.target.value as typeof chargeDisposition,
              )
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("visit.choose")}</option>
            <option value="paid" disabled={!paidReady}>
              {t("visit.invoiceFullyPaid")}{paidReady ? "" : ` — ${t("visit.notReady")}`}
            </option>
            <option
              value="accounts_receivable"
              disabled={!accountsReceivableReady}
            >
              {t("visit.payLaterDueDate")}
            </option>
            <option value="no_charge" disabled={!noChargeReady}>
              {t("visit.noChargeForVisit")}{noChargeReady ? "" : ` — ${t("visit.invoiceExists")}`}
            </option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="closeout-handoff">
            {t("visit.ownerHandoff")}
          </label>
          <select
            id="closeout-handoff"
            value={handoffMethod}
            onChange={(event) =>
              setHandoffMethod(event.target.value as typeof handoffMethod)
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("visit.choose")}</option>
            <option value="print">{t("visit.printedDownloaded")}</option>
            <option value="verbal">{t("visit.reviewedVerbally")}</option>
            <option value="declined">{t("visit.ownerDeclined")}</option>
          </select>
        </div>
      </div>
      {chargeDisposition === "no_charge" ? (
        <div>
          <label className="text-sm font-medium" htmlFor="closeout-no-charge">
            {t("visit.noChargeReason")}
          </label>
          <Input
            id="closeout-no-charge"
            value={noChargeReason}
            onChange={(event) => setNoChargeReason(event.target.value)}
            className="mt-1"
          />
        </div>
      ) : null}
      {chargeDisposition === "accounts_receivable" ? (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
          <label
            className="text-sm font-medium"
            htmlFor="closeout-invoice-due-date"
          >
            {t("visit.paymentDueDate")}
          </label>
          <Input
            id="closeout-invoice-due-date"
            type="date"
            min={minimumDueDate}
            value={invoiceDueDate}
            onChange={(event) => setInvoiceDueDate(event.target.value)}
            className="mt-1 max-w-xs"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("visit.accountsReceivableDescription")}
          </p>
        </div>
      ) : null}
      {activeInvoice ? (
        <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            {t("visit.invoiceIs")} <strong>{activeInvoice.status}</strong>, {t("visit.has")} {activeInvoice.itemCount} {t("visit.invoiceLines")}, {t("visit.balanceOf")}{" "}
          {formatCurrency(activeInvoice.balanceDueCents / 100)}.{" "}
          {paidReady
            ? `${t("visit.readyForPaidCheckout")} `
            : accountsReceivableReady
              ? `${t("visit.readyForReceivableCheckout")} `
              : `${t("visit.saveChargesValidDueDate")} `}
          <Button variant="link" size="sm" asChild className="h-auto p-0">
            <Link href={`/billing?expand=${activeInvoice.id}`}>
              {t("visit.openBilling")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>
            {t("visit.noActiveInvoiceExists")}
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="#charge-capture">{t("visit.captureVisitCharges")}</a>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          {t("visit.downloadDischarge")}
        </Button>
        <Button disabled={!canComplete} onClick={onComplete}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {t("visit.completeVisit")}
        </Button>
      </div>
    </div>
  );
}

function EncounterInvoices({
  appointmentId,
  invoicesQuery,
  visitInvoices,
  canManage,
}: {
  appointmentId: string;
  invoicesQuery: InvoiceQueryState;
  visitInvoices: Array<{
    id: string;
    status: string;
    total: string;
    paidAmount: string;
    adjustedAmount: string;
    isEstimate: boolean;
  }>;
  canManage: boolean;
}) {
  const t = useTranslations();
  const fmt = useCurrencyFormatterWithConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("visit.invoiceState")}</CardTitle>
        <CardDescription>
          {t("visit.invoiceDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoicesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("visit.loadingInvoices")}
          </div>
        ) : invoicesQuery.error || !invoicesQuery.data ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.invoiceLoadError")}
          </div>
        ) : visitInvoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t("visit.noActiveInvoiceForVisit")}
            description={
              canManage
                ? t("visit.addKnownChargesDescription")
                : t("visit.adminCanCreateCharges")
            }
            className="p-8"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visitInvoices.map((invoice) => {
              const paid = Number(invoice.paidAmount ?? 0);
              const adjusted = Number(invoice.adjustedAmount ?? 0);
              const balance = Math.max(
                0,
                Number(invoice.total ?? 0) - paid - adjusted,
              );
              return (
                <div
                  key={invoice.id}
                  className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {invoice.isEstimate ? t("visit.estimate") : t("visit.invoice")}
                      </p>
                      <Badge
                        variant={
                          invoice.status === "paid" ? "success" : "outline"
                        }
                      >
                        {invoiceStatusLabel(invoice.status, t)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("visit.total")} {fmt(invoice.total)} · {t("visit.balance")} {fmt(balance)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/billing?expand=${invoice.id}`}>
                      {t("visit.openInvoice")}
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
         <span className="sr-only">{t("visit.appointmentReference")} {appointmentId}</span>
      </CardContent>
    </Card>
  );
}

function useCurrencyFormatterWithConfig() {
  const config = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  return (value: number | string | null | undefined) =>
    formatCurrency(
      value,
      config.data?.currency ?? "usd",
      config.data?.country ?? "US",
    );
}

function VisitWorkReconciliation({
  appointmentId,
  canManage,
  canCorrect,
  canVoid,
}: {
  appointmentId: string;
  canManage: boolean;
  canCorrect: boolean;
  canVoid: boolean;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const fmt = useCurrencyFormatterWithConfig();
  const reconciliation = trpc.encounters.getVisitReconciliation.useQuery({
    appointmentId,
  });
  const [selectedCharges, setSelectedCharges] = useState<
    Record<string, string>
  >({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const resolve = trpc.encounters.resolveVisitWork.useMutation({
    onSuccess: () => {
      toast.success(t("visit.performedItemReconciled"));
      utils.encounters.getVisitReconciliation.invalidate({ appointmentId });
    },
    onError: (error) => toast.error(error.message),
  });
  const reopen = trpc.encounters.reopenVisitWork.useMutation({
    onSuccess: () => {
      toast.success(t("visit.reconciliationReopened"));
      utils.encounters.getVisitReconciliation.invalidate({ appointmentId });
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card id="visit-work-reconciliation" className="scroll-mt-4">
      <CardHeader>
        <CardTitle>{t("visit.performedWorkReconciliation")}</CardTitle>
        <CardDescription>
          {t("visit.reconciliationDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reconciliation.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("visit.reconciliationLoading")}
          </div>
        ) : reconciliation.error || !reconciliation.data ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.reconciliationLoadError")}
          </div>
        ) : reconciliation.data.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("visit.noWorkItems")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
              <span>{t("visit.itemsRequiringAttention")}</span>
              <Badge
                variant={
                  reconciliation.data.unresolvedCount > 0
                    ? "destructive"
                    : "success"
                }
              >
                {reconciliation.data.unresolvedCount}
              </Badge>
            </div>
            {reconciliation.data.items.map((item) => {
              const unresolved = item.status === "unresolved";
              const staleCharge =
                item.status === "charged" && !item.chargeLinkActive;
              const suggestedCatalog = item.suggestedProductId
                ? `${item.suggestedProductName} (${fmt(item.suggestedProductPrice)})`
                : item.suggestedService
                  ? `${item.suggestedService.name} (${fmt(item.suggestedService.defaultPrice)})`
                  : null;
              const reason = reasons[item.id] ?? "";
              const selectedCharge = selectedCharges[item.id] ?? "";
              return (
                <div
                  key={item.id}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.sourceLabel}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                         {visitSourceTypeLabel(item.sourceType, t)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        unresolved || staleCharge ? "destructive" : "outline"
                      }
                    >
                      {staleCharge
                        ? t("visit.chargeRemoved")
                        : item.status === "charged"
                          ? t("visit.charged")
                          : item.status === "no_charge"
                            ? t("visit.noChargeShort")
                            : item.status === "voided"
                              ? t("visit.voided")
                              : t("visit.unresolved")}
                    </Badge>
                  </div>

                  {unresolved || staleCharge ? (
                    <div className="mt-4 flex flex-col gap-3">
                      <p className="text-xs text-muted-foreground">
                        {suggestedCatalog
                          ? `${t("visit.suggestedCatalogMatch")} ${suggestedCatalog}. ${t("visit.addSaveLinkCharge")}`
                          : t("visit.addSaveLinkChargeNoSuggestion")}
                      </p>
                      {unresolved && canManage ? (
                        <>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                              aria-label={`${t("visit.invoiceChargeFor")} ${item.sourceLabel}`}
                              value={selectedCharge}
                              disabled={resolve.isPending || reopen.isPending}
                              onChange={(event) =>
                                setSelectedCharges((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">
                                {t("visit.chooseSavedInvoiceLine")}
                              </option>
                              {reconciliation.data.invoiceItemOptions.map(
                                (charge) => (
                                  <option key={charge.id} value={charge.id}>
                                    {charge.description} · {t("visit.qty")} {charge.quantity}{" "}
                                    · {fmt(charge.total)}
                                  </option>
                                ),
                              )}
                            </select>
                            <Button
                              variant="outline"
                              disabled={
                                !selectedCharge ||
                                resolve.isPending ||
                                reopen.isPending
                              }
                              onClick={() =>
                                resolve.mutate({
                                  appointmentId,
                                  workItemId: item.id,
                                  resolution: {
                                    status: "charged",
                                    invoiceItemId: selectedCharge,
                                  },
                                })
                              }
                            >
                              {t("visit.linkConfirmedCharge")}
                            </Button>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={reason}
                              maxLength={500}
                              placeholder={t("visit.reconciliationReason")}
                              aria-label={`${t("visit.reconciliationReasonLabel")} ${item.sourceLabel}`}
                              disabled={resolve.isPending || reopen.isPending}
                              onChange={(event) =>
                                setReasons((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              variant="outline"
                              disabled={
                                reason.trim().length < 3 ||
                                resolve.isPending ||
                                reopen.isPending
                              }
                              onClick={() =>
                                resolve.mutate({
                                  appointmentId,
                                  workItemId: item.id,
                                  resolution: {
                                    status: "no_charge",
                                    reason: reason.trim(),
                                  },
                                })
                              }
                            >
                              {t("visit.noChargeShort")}
                            </Button>
                            {canVoid ? (
                              <Button
                                variant="outline"
                                disabled={
                                  reason.trim().length < 3 ||
                                  resolve.isPending ||
                                  reopen.isPending
                                }
                                onClick={() =>
                                  resolve.mutate({
                                    appointmentId,
                                    workItemId: item.id,
                                    resolution: {
                                      status: "voided",
                                      reason: reason.trim(),
                                    },
                                  })
                                }
                              >
                                {t("visit.voidCorrected")}
                              </Button>
                            ) : null}
                          </div>
                        </>
                      ) : staleCharge ? (
                        <p className="text-sm text-destructive">
                          {t("visit.staleChargeDescription")}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t("visit.teammateMustReconcile")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.status === "charged"
                        ? `${t("visit.linkedCharge")} ${item.invoiceItemDescription}`
                        : item.status === "no_charge"
                          ? `${t("visit.noChargeReasonLabel")} ${item.noChargeReason}`
                          : `${t("visit.voidReasonLabel")} ${item.voidReason}`}
                      {item.resolvedByName ? ` · ${item.resolvedByName}` : ""}
                    </p>
                  )}

                  {!unresolved && canCorrect ? (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
                      <Input
                        value={reason}
                        maxLength={500}
                        placeholder={t("visit.reconciliationCorrectionPlaceholder")}
                        aria-label={`${t("visit.correctionReasonLabel")} ${item.sourceLabel}`}
                        disabled={resolve.isPending || reopen.isPending}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        variant="outline"
                        disabled={
                          reason.trim().length < 5 ||
                          resolve.isPending ||
                          reopen.isPending
                        }
                        onClick={() =>
                          reopen.mutate({
                            appointmentId,
                            workItemId: item.id,
                            reason: reason.trim(),
                          })
                        }
                      >
                        {t("visit.reopenForCorrection")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChargeCapture({
  appointmentId,
  clientId,
  patientId,
  canManage,
  activeInvoice,
  invoiceStateReady,
  invoiceStateLoading,
  linkedPrescriptions,
}: {
  appointmentId: string;
  clientId: string | null;
  patientId: string | null;
  canManage: boolean;
  activeInvoice: { id: string; status: string } | null;
  invoiceStateReady: boolean;
  invoiceStateLoading: boolean;
  linkedPrescriptions: Array<{
    id: string;
    medicationName: string;
    dosage: string;
    quantity: number | null;
    productId: string | null;
    productName: string | null;
    productUnitPrice: string | null;
    productTaxable: boolean | null;
    dispenseChargeId: string | null;
    dispenseChargeStatus: "pending" | "invoiced" | "waived" | null;
    dispenseChargeDescription: string | null;
  }>;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const isOnline = useOnlineStatus();
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<ChargeItem[]>([]);
  const [loadedInvoiceId, setLoadedInvoiceId] = useState<string | null>(null);
  const lastSavedItemsFingerprintRef = useRef(chargeItemsFingerprint([]));
  const configQuery = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const configReady = Boolean(configQuery.data) && !configQuery.error;
  const activeInvoiceIsDraft = activeInvoice?.status === "draft";
  const invoiceDetailQuery = trpc.billing.getInvoice.useQuery(
    {
      id: activeInvoice?.id ?? "00000000-0000-0000-0000-000000000000",
    },
    { enabled: Boolean(canManage && activeInvoiceIsDraft) },
  );
  const invoiceDetailReady =
    !activeInvoice ||
    (activeInvoiceIsDraft && Boolean(invoiceDetailQuery.data));
  const servicesQuery = trpc.billing.listServices.useQuery(undefined, {
    enabled:
      canManage &&
      configReady &&
      invoiceStateReady &&
      (!activeInvoice || (activeInvoiceIsDraft && invoiceDetailReady)),
  });
  const productsQuery = trpc.billing.listProducts.useQuery(
    { limit: 100 },
    {
      enabled:
        canManage &&
        configReady &&
        invoiceStateReady &&
        (!activeInvoice || (activeInvoiceIsDraft && invoiceDetailReady)),
    },
  );

  useEffect(() => {
    if (!activeInvoice) {
      if (loadedInvoiceId) {
        setItems([]);
        lastSavedItemsFingerprintRef.current = chargeItemsFingerprint([]);
        setLoadedInvoiceId(null);
      }
      return;
    }
    if (
      activeInvoiceIsDraft &&
      invoiceDetailQuery.data?.id === activeInvoice.id &&
      loadedInvoiceId !== activeInvoice.id
    ) {
      const loadedItems = invoiceDetailQuery.data.items.map((item) => ({
        key: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
        itemId: item.itemId ?? undefined,
        taxable: item.taxable,
        sourcePrescriptionId: item.sourcePrescriptionId ?? undefined,
        sourceDispenseChargeId: item.sourceDispenseChargeId ?? undefined,
      }));
      setItems(loadedItems);
      lastSavedItemsFingerprintRef.current =
        chargeItemsFingerprint(loadedItems);
      setLoadedInvoiceId(activeInvoice.id);
    }
  }, [
    activeInvoice,
    activeInvoiceIsDraft,
    invoiceDetailQuery.data,
    loadedInvoiceId,
  ]);

  const catalog = useMemo(() => {
    const services = (servicesQuery.data ?? []).map((service) => ({
      id: `service:${service.id}`,
      itemId: service.id,
      itemType: "service" as const,
      name: service.name,
      code: service.code,
      category: [t("visit.service"), service.category].filter(Boolean).join(" · "),
      defaultPrice: service.defaultPrice,
      taxable: service.taxable,
      inventoryTracked: null as boolean | null,
      stockQuantity: null as number | null,
      quantity: null as number | null,
      sourcePrescriptionId: undefined as string | undefined,
      sourceDispenseChargeId: undefined as string | undefined,
    }));
    const linkedProductIds = new Set(
      linkedPrescriptions
        .filter(
          (prescription) =>
            prescription.dispenseChargeStatus === "pending" &&
            Boolean(prescription.dispenseChargeDescription) &&
            !requiresPrescriptionInventoryUnitReview({
              description: prescription.dispenseChargeDescription!,
            }),
        )
        .map((prescription) => prescription.productId)
        .filter((id): id is string => Boolean(id)),
    );
    const prescriptionCharges = linkedPrescriptions
      .filter(
        (prescription) =>
          prescription.productId &&
          prescription.productUnitPrice &&
          prescription.quantity &&
          prescription.dispenseChargeId &&
          prescription.dispenseChargeStatus === "pending" &&
          prescription.dispenseChargeDescription &&
          !requiresPrescriptionInventoryUnitReview({
            description: prescription.dispenseChargeDescription,
          }),
      )
      .map((prescription) => ({
        id: `prescription:${prescription.id}`,
        itemId: prescription.productId!,
        itemType: "product" as const,
        name: prescription.dispenseChargeDescription!,
        category: `${t("visit.visitPrescription")} · ${t("visit.inventoryAlreadyDispensed")}`,
        defaultPrice: prescription.productUnitPrice!,
        taxable: prescription.productTaxable ?? true,
        inventoryTracked: true as boolean | null,
        stockQuantity: null as number | null,
        quantity: prescription.quantity!,
        sourcePrescriptionId: undefined as string | undefined,
        sourceDispenseChargeId: prescription.dispenseChargeId!,
      }));
    const products = (productsQuery.data ?? [])
      .filter((product) => !linkedProductIds.has(product.id))
      .map((product) => ({
        id: `product:${product.id}`,
        itemId: product.id,
        itemType: "product" as const,
        name: product.name,
        category: product.inventoryTracked
          ? `${t("visit.product")} · ${product.stockQuantity} ${t("visit.inStock")}`
          : `${t("visit.product")} · ${t("visit.stockNotTracked")}`,
        defaultPrice: product.unitPrice,
        taxable: product.taxable,
        inventoryTracked: product.inventoryTracked,
        stockQuantity: product.inventoryTracked ? product.stockQuantity : null,
        quantity: null as number | null,
        sourcePrescriptionId: undefined as string | undefined,
        sourceDispenseChargeId: undefined as string | undefined,
      }));
    return [...prescriptionCharges, ...services, ...products];
  }, [linkedPrescriptions, productsQuery.data, servicesQuery.data, t]);

  const selected = catalog.find((entry) => entry.id === selectedCatalogId);
  const readyVisitPrescriptionCharges = catalog.filter(
    (entry) =>
      entry.sourceDispenseChargeId &&
      !items.some(
        (item) => item.sourceDispenseChargeId === entry.sourceDispenseChargeId,
      ),
  );
  const prescriptionChargesNeedingUnitReview = linkedPrescriptions.filter(
    (prescription) =>
      prescription.dispenseChargeStatus === "pending" &&
      Boolean(prescription.dispenseChargeDescription) &&
      requiresPrescriptionInventoryUnitReview({
        description: prescription.dispenseChargeDescription!,
      }),
  );
  useEffect(() => {
    setQuantity(selected?.quantity ?? 1);
  }, [selected?.id, selected?.quantity]);
  const previewTotals = tryCalculateInvoiceTaxTotals(
    items.map((item) => ({
      lineTotalCents: item.quantity * moneyToCents(item.unitPrice || "0"),
      taxable: item.taxable,
    })),
    configQuery.data?.taxRatePercent ?? "0.00",
  );
  const subtotal = centsToMoney(previewTotals?.subtotalCents ?? 0);
  const tax = centsToMoney(previewTotals?.taxCents ?? 0);
  const total = centsToMoney(previewTotals?.totalCents ?? 0);
  const fmt = (value: number | string | null | undefined) =>
    formatCurrency(
      value,
      configQuery.data?.currency ?? "usd",
      configQuery.data?.country ?? "US",
    );
  const selectedHasStock =
    selected?.itemType !== "product" ||
    Boolean(selected.sourcePrescriptionId) ||
    Boolean(selected.sourceDispenseChargeId) ||
    selected.inventoryTracked === false ||
    (selected.stockQuantity !== null && quantity <= selected.stockQuantity);
  const canAdd =
    Boolean(selected) &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    selectedHasStock &&
    items.length < BILLING_INVOICE_MAX_ITEMS;
  const canSubmit =
    Boolean(clientId && patientId) &&
    isOnline &&
    items.length > 0 &&
    items.every((item) =>
      isBillingInvoiceLineTotalValid(item.unitPrice, item.quantity),
    ) &&
    isBillingInvoiceSubtotalValid(items) &&
    Boolean(previewTotals) &&
    configReady &&
    invoiceStateReady &&
    invoiceDetailReady &&
    (!activeInvoice || activeInvoiceIsDraft);

  const createInvoice = trpc.billing.createInvoice.useMutation({
    onSuccess: () => {
      toast.success(t("visit.visitChargesSaved"));
      setItems([]);
      lastSavedItemsFingerprintRef.current = chargeItemsFingerprint([]);
      setSelectedCatalogId("");
      setQuantity(1);
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      });
      utils.encounters.getCloseout.invalidate({ appointmentId });
    },
    onError: (error) => toast.error(error.message),
  });
  const updateInvoiceItems = trpc.billing.updateInvoiceItems.useMutation({
    onSuccess: () => {
      toast.success(t("visit.visitChargesUpdated"));
      lastSavedItemsFingerprintRef.current = chargeItemsFingerprint(items);
      utils.billing.listInvoices.invalidate({
        appointmentId,
        limit: 25,
        offset: 0,
      });
      utils.encounters.getCloseout.invalidate({ appointmentId });
      if (activeInvoice) {
        utils.billing.getInvoice.invalidate({ id: activeInvoice.id });
      }
    },
    onError: (error) => toast.error(error.message),
  });
  const isSaving = createInvoice.isPending || updateInvoiceItems.isPending;
  const hasUnsavedCharges =
    chargeItemsFingerprint(items) !== lastSavedItemsFingerprintRef.current;
  useUnsavedChangesGuard(
    hasUnsavedCharges,
    t("visit.unsavedChargesLeaveConfirm"),
  );

  function addCatalogItem(
    entry: (typeof catalog)[number],
    itemQuantity: number,
  ) {
    if (
      items.length >= BILLING_INVOICE_MAX_ITEMS ||
      (entry.sourceDispenseChargeId &&
        items.some(
          (item) =>
            item.sourceDispenseChargeId === entry.sourceDispenseChargeId,
        ))
    ) {
      return;
    }
    setItems((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        description: entry.name,
        quantity: itemQuantity,
        unitPrice: entry.defaultPrice,
        itemType: entry.itemType,
        itemId: entry.itemId,
        taxable: entry.taxable,
        sourcePrescriptionId: entry.sourcePrescriptionId,
        sourceDispenseChargeId: entry.sourceDispenseChargeId,
      },
    ]);
  }

  function addSelectedItem() {
    if (!selected || !canAdd) return;
    addCatalogItem(selected, quantity);
    setSelectedCatalogId("");
    setQuantity(1);
  }

  function saveCharges() {
    if (!clientId || !patientId || !canSubmit) return;
    const lineItems = items.map(
      ({
        description,
        quantity,
        unitPrice,
        itemType,
        itemId,
        sourcePrescriptionId,
        sourceDispenseChargeId,
      }) => ({
        description,
        quantity,
        unitPrice,
        itemType,
        itemId,
        sourcePrescriptionId,
        sourceDispenseChargeId,
      }),
    );
    if (activeInvoice) {
      if (!invoiceDetailQuery.data) return;
      updateInvoiceItems.mutate({
        id: activeInvoice.id,
        expectedUpdatedAt: invoiceDetailQuery.data.updatedAt,
        items: lineItems,
      });
      return;
    }
    createInvoice.mutate({
      appointmentId,
      clientId,
      patientId,
      items: lineItems,
      isEstimate: false,
    });
  }

  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle>{t("visit.chargeCapture")}</CardTitle>
        <CardDescription>
          {activeInvoiceIsDraft
            ? t("visit.correctOrAddCharges")
            : t("visit.addPerformedCharges")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!canManage ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {t("visit.readOnlyChargeCapture")}
          </div>
        ) : invoiceStateLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("visit.confirmingInvoiceState")}
          </div>
        ) : !invoiceStateReady ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.invoiceStateLocked")}
          </div>
        ) : activeInvoice && !activeInvoiceIsDraft ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {t("visit.invoiceAlreadyStatus")} {invoiceStatusLabel(activeInvoice.status, t)}. {t("visit.openInvoiceState")} {t("visit.invoiceDraftOnly")}
          </div>
        ) : activeInvoiceIsDraft && invoiceDetailQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("visit.loadingVisitCharges")}
          </div>
        ) : activeInvoiceIsDraft &&
          (invoiceDetailQuery.error || !invoiceDetailQuery.data) ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.visitChargesLoadError")}
          </div>
        ) : configQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("visit.loadingTaxCurrency")}
          </div>
        ) : !configReady ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.taxCurrencyLocked")}
          </div>
        ) : !previewTotals ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.taxCurrencyInvalid")}
          </div>
        ) : !clientId || !patientId ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.clientPatientRequired")}
          </div>
        ) : servicesQuery.error || productsQuery.error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {t("visit.catalogLoadError")}
          </div>
        ) : servicesQuery.isLoading || productsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("visit.loadingCatalog")}
          </div>
        ) : catalog.length === 0 && items.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t("visit.emptyCatalog")}
            description={t("visit.emptyCatalogDescription")}
            className="p-8"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {!isOnline ? (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                role="status"
              >
                {t("visit.offlineCharges")}
              </div>
            ) : null}
            {readyVisitPrescriptionCharges.length > 0 ? (
              <div className="rounded-md border border-primary/30 bg-primary/[0.04] p-3">
                <p className="text-sm font-medium">{t("visit.readyFromVisit")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("visit.prescriptionChargesDescription")}
                </p>
                <div
                  className="mt-3 flex flex-col gap-2"
                  aria-label={t("visit.readyPrescriptionCharges")}
                >
                  {readyVisitPrescriptionCharges.map((entry) => (
                    <Button
                      key={entry.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-auto justify-between gap-3 whitespace-normal py-2 text-left"
                       aria-label={`${t("visit.addVisitCharge")} ${entry.name}`}
                      disabled={
                        isSaving || items.length >= BILLING_INVOICE_MAX_ITEMS
                      }
                      onClick={() => addCatalogItem(entry, entry.quantity ?? 1)}
                    >
                      <span>{entry.name}</span>
                      <span className="shrink-0 text-right text-muted-foreground">
                        {entry.quantity ?? 1} × {fmt(entry.defaultPrice)}
                        <span className="block font-medium text-foreground">
                          {fmt(
                            centsToMoney(
                              moneyToCents(entry.defaultPrice) *
                                (entry.quantity ?? 1),
                            ),
                          )}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {prescriptionChargesNeedingUnitReview.length > 0 ? (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                role="alert"
              >
                <p className="font-medium">
                  {t("visit.reviewMedicationUnit")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("visit.legacyPackageWarning")}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {prescriptionChargesNeedingUnitReview.map((prescription) => (
                    <li key={prescription.id}>
                      {prescription.dispenseChargeDescription} · {t("visit.quantity")} {prescription.quantity ?? t("visit.notRecorded")}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                >
                  <Link href="/inventory">{t("visit.reviewInventoryUnits")}</Link>
                </Button>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_auto] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_80px_auto]">
              <ServicePicker
                services={catalog}
                value={selectedCatalogId}
                onSelect={setSelectedCatalogId}
                disabled={isSaving}
                formatPrice={fmt}
              />
              <Input
                type="number"
                min={1}
                max={selected?.stockQuantity ?? undefined}
                value={quantity}
                aria-label={t("visit.chargeQuantity")}
                aria-invalid={!selectedHasStock}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canAdd || isSaving}
                onClick={addSelectedItem}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("visit.add")}
              </Button>
            </div>

            {!selectedHasStock ? (
              <p className="text-xs font-medium text-destructive">
                {t("visit.inventoryExceeded")}
              </p>
            ) : null}

            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t("visit.noChargesYet")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.description}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {item.itemType === "service"
                          ? t("visit.service")
                          : t("visit.product")} ·{" "}
                        {item.taxable ? t("visit.taxable") : t("visit.notTaxable")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t("visit.qty")}
                        <Input
                          type="number"
                          min={1}
                          max={10000}
                          value={item.quantity}
                          aria-label={`${t("visit.quantityFor")} ${item.description}`}
                          className="w-20 text-foreground"
                          disabled={isSaving}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((candidate) =>
                                candidate.key === item.key
                                  ? {
                                      ...candidate,
                                      quantity: Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    }
                                  : candidate,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {t("visit.unitPrice")}
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          aria-label={`${t("visit.unitPriceFor")} ${item.description}`}
                          className="w-28 text-foreground"
                          disabled={isSaving}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((candidate) =>
                                candidate.key === item.key
                                  ? {
                                      ...candidate,
                                      unitPrice: event.target.value,
                                    }
                                  : candidate,
                              ),
                            )
                          }
                        />
                      </label>
                      <span className="flex w-24 flex-col gap-1 text-right text-xs text-muted-foreground">
                        {t("visit.lineTotal")}
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          {fmt(item.quantity * Number(item.unitPrice || 0))}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end"
                        aria-label={`${t("visit.remove")} ${item.description}`}
                        disabled={isSaving}
                        onClick={() =>
                          setItems((current) =>
                            current.filter(
                              (candidate) => candidate.key !== item.key,
                            ),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-md bg-muted/30 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("visit.subtotal")}</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("visit.tax")} ({configQuery.data?.taxRatePercent ?? "0.00"}%)
                  </span>
                  <span>{fmt(tax)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>{t("visit.draftTotal")}</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            ) : null}

            <Button disabled={!canSubmit || isSaving} onClick={saveCharges}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="mr-2 h-4 w-4" />
              )}
              {activeInvoiceIsDraft
                ? t("visit.updateInvoice")
                : t("visit.createInvoice")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {activeInvoiceIsDraft
                ? t("visit.updateInvoiceStockDescription")
                : t("visit.createInvoiceStockDescription")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
