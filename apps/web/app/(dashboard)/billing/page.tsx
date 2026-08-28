"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Send,
  CheckCircle,
  Loader2,
  Plus,
  DollarSign,
  ArrowRightLeft,
  Download,
  Mail,
  Ban,
  CreditCard,
  CalendarClock,
  Pill,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage, useTranslations } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/messages";
import { trpc } from "@/lib/trpc";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { ActionConfirmationDialog } from "@/components/common/action-confirmation-dialog";
import { TableSkeleton } from "@/components/common/loading";
import { TableScroll } from "@/components/common/table-scroll";
import {
  BILLING_ADJUSTMENT_REASON_MAX_LENGTH,
  BILLING_NOTES_MAX_LENGTH,
  BILLING_PAYMENT_AMOUNT_MIN,
  BILLING_UNIT_PRICE_MAX,
  isBillingAmountWithinBalance,
} from "@/lib/billing/policy";
import { isSafeCheckoutRedirectUrl } from "@/lib/checkout-redirect";

const STATUS_TABS = [
  { labelKey: "billing.all", value: undefined, isEstimate: false as const },
  { labelKey: "billing.draft", value: "draft", isEstimate: false as const },
  { labelKey: "billing.sent", value: "sent", isEstimate: false as const },
  { labelKey: "billing.paid", value: "paid", isEstimate: false as const },
  { labelKey: "billing.overdue", value: "overdue", isEstimate: false as const },
  { labelKey: "billing.void", value: "void", isEstimate: false as const },
  { labelKey: "billing.estimates", value: undefined, isEstimate: true as const },
] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-500",
  partial: "bg-amber-100 text-amber-700",
  settled: "bg-teal-100 text-teal-700",
  estimate: "bg-purple-100 text-purple-700",
};

const INVOICE_STATUS_LABEL_KEYS: Record<string, Parameters<Translator>[0]> = {
  draft: "billing.draft",
  sent: "billing.sent",
  paid: "billing.paid",
  overdue: "billing.overdue",
  void: "billing.void",
};

const PAYMENT_METHODS = [
  { labelKey: "billing.cash", value: "cash" },
  { labelKey: "billing.creditCard", value: "credit_card" },
  { labelKey: "billing.debitCard", value: "debit_card" },
  { labelKey: "billing.check", value: "check" },
  { labelKey: "billing.online", value: "online" },
  { labelKey: "billing.other", value: "other" },
] as const;

const BILLING_ACTION_REASON_MIN_LENGTH = 5;
const BILLING_ACTION_REASON_MAX_LENGTH = 500;

function canManageBillingRole(role?: string | null): boolean {
  return role === "admin" || role === "front_desk";
}

function formatBillingDateInput(
  value: Date | string,
  timeZone?: string | null,
  locale = "en-US",
) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      locale,
      { timeZone: "UTC" }
    );
  }

  return formatBillingInstantDate(value, timeZone, locale);
}

function formatBillingInstantDate(
  value: Date | string,
  timeZone?: string | null,
  locale = "en-US",
) {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeZone: timeZone ?? undefined,
  };

  try {
    return new Date(value).toLocaleDateString(locale, options);
  } catch {
    return new Date(value).toLocaleDateString(locale, {
      ...options,
      timeZone: undefined,
    });
  }
}

function getDisplayStatus(invoice: {
  status: string;
  paidAmount: string | null;
  adjustedAmount?: string | null;
  total: string | null;
  isEstimate: boolean;
}): { label: string; style: string } {
  if (invoice.isEstimate) {
    return { label: "billing.estimate", style: STATUS_STYLES.estimate };
  }
  const paid = Number(invoice.paidAmount ?? 0);
  const adjusted = Number(invoice.adjustedAmount ?? 0);
  const total = Number(invoice.total ?? 0);
  if (
    total > 0 &&
    adjusted > 0 &&
    paid + adjusted >= total &&
    invoice.status !== "paid" &&
    invoice.status !== "void"
  ) {
    return { label: "billing.settled", style: STATUS_STYLES.settled };
  }
  if (paid + adjusted > 0 && paid + adjusted < total && invoice.status !== "paid") {
    return { label: "billing.partial", style: STATUS_STYLES.partial };
  }
  const label = INVOICE_STATUS_LABEL_KEYS[invoice.status] ?? "billing.unknownStatus";
  return {
    label,
    style: STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft,
  };
}

export default function BillingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations();
  const language = useLanguage();
  const locale = language === "es" ? "es-CR" : "en-US";
  const formatCurrency = useCurrencyFormatter();
  const canManageBilling = canManageBillingRole(session?.user?.role);
  const canWaiveDispenseCharges = session?.user?.role === "admin";
  const [activeTab, setActiveTab] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pendingInvoiceVoidId, setPendingInvoiceVoidId] = useState<
    string | null
  >(null);
  const [invoiceVoidReason, setInvoiceVoidReason] = useState("");
  const limit = 25;

  // Deep link: /billing?expand=<invoiceId> opens that invoice's detail (the
  // welcome tour uses this to walk into a real invoice). After mount so the
  // server render stays stable.
  useEffect(() => {
    const expand = new URLSearchParams(window.location.search).get("expand");
    if (expand) setExpandedId(expand);
  }, []);

  const tab = STATUS_TABS[activeTab];
  const statusFilter = tab.isEstimate ? undefined : tab.value;
  const isEstimateFilter = tab.isEstimate ? true : false;

  const billingConfig = trpc.billing.getTaxConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const { data, isLoading, error } = trpc.billing.listInvoices.useQuery({
    status: statusFilter,
    isEstimate: isEstimateFilter,
    limit,
    offset,
  });
  const arSummary = trpc.billing.arSummary.useQuery(undefined, {
    staleTime: 60 * 1000,
  });
  const listError = billingConfig.error ?? error;
  const isListLoading = billingConfig.isLoading || isLoading;
  const billingConfigMissing =
    !billingConfig.isLoading && !billingConfig.error && !billingConfig.data;
  const verifiedBillingConfig =
    billingConfig.error || !billingConfig.data ? null : billingConfig.data;
  const billingSettingsReady = verifiedBillingConfig !== null;
  const billingTimeZone = verifiedBillingConfig
    ? verifiedBillingConfig.timezone
    : null;
  const invoiceListMissing = !isLoading && !error && !data;
  const billingListMissing = billingConfigMissing || invoiceListMissing;

  const utils = trpc.useUtils();

  const updateStatus = trpc.billing.updateInvoiceStatus.useMutation({
    onSuccess: () => {
      toast.success(t("billing.invoiceStatusUpdated"));
      utils.billing.listInvoices.invalidate();
      utils.billing.getInvoice.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const convertEstimate = trpc.billing.convertEstimateToInvoice.useMutation({
    onSuccess: () => {
      toast.success(t("billing.estimateConverted"));
      utils.billing.listInvoices.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const voidInvoice = trpc.billing.voidInvoice.useMutation({
    onSuccess: () => {
      toast.success(t("billing.invoiceVoided"));
      utils.billing.listInvoices.invalidate();
      utils.billing.getInvoice.invalidate();
      utils.billing.listDispenseChargeQueue.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleStatusChange = (
    e: React.MouseEvent,
    id: string,
    status: "sent"
  ) => {
    e.stopPropagation();
    updateStatus.mutate({ id, status });
  };

  const handleConvertEstimate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    convertEstimate.mutate({ id });
  };

  const handleVoidInvoice = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setInvoiceVoidReason("");
    setPendingInvoiceVoidId(id);
  };

  const closeInvoiceVoidDialog = () => {
    if (voidInvoice.isPending) return;
    setPendingInvoiceVoidId(null);
    setInvoiceVoidReason("");
  };

  const confirmInvoiceVoid = () => {
    const reason = invoiceVoidReason.trim();
    if (
      !pendingInvoiceVoidId ||
      reason.length < BILLING_ACTION_REASON_MIN_LENGTH
    ) {
      return;
    }
    voidInvoice.mutate(
      { id: pendingInvoiceVoidId, reason },
      {
        onSuccess: () => {
          setPendingInvoiceVoidId(null);
          setInvoiceVoidReason("");
        },
      },
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">{t("billing.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("billing.subtitle")}
          </p>
        </div>
        {canManageBilling && (
          <Button asChild>
            <Link href="/billing/new">
              <Plus className="mr-1 h-4 w-4" />
              {t("billing.newInvoice")}
            </Link>
          </Button>
        )}
      </div>

      <DispenseChargeQueuePanel
        canManage={canManageBilling}
        canWaive={canWaiveDispenseCharges}
        billingTimeZone={billingTimeZone}
        onInvoiceCreated={setExpandedId}
      />

      <WellnessBillingPanel
        billingTimeZone={billingTimeZone}
        settingsReady={billingSettingsReady}
        canManageBilling={canManageBilling}
      />

      {/* Accounts receivable at a glance */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("billing.outstanding")}</p>
          <p className="mt-1 font-heading text-2xl font-semibold">
            {arSummary.isError
              ? "—"
              : arSummary.data
                ? formatCurrency(arSummary.data.outstanding)
                : "…"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("billing.overdue")}</p>
          <p
            className={`mt-1 font-heading text-2xl font-semibold ${
              arSummary.data && Number(arSummary.data.overdue) > 0
                ? "text-destructive"
                : ""
            }`}
          >
            {arSummary.isError
              ? "—"
              : arSummary.data
                ? formatCurrency(arSummary.data.overdue)
                : "…"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("billing.collectedThisMonth")}</p>
          <p className="mt-1 font-heading text-2xl font-semibold">
            {arSummary.isError
              ? "—"
              : arSummary.data
                ? formatCurrency(arSummary.data.collectedThisMonth)
                : "…"}
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mt-6 flex items-center gap-1 border-b border-border">
        {STATUS_TABS.map((tabOption, idx) => (
          <button
            key={tabOption.labelKey}
            onClick={() => {
              setActiveTab(idx);
              setOffset(0);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === idx
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tabOption.labelKey)}
          </button>
        ))}
      </div>

      {listError || billingListMissing ? (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
         {listError?.message ?? t("billing.invoiceLoadError")}
        </div>
      ) : isListLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : data && verifiedBillingConfig && data.items.length > 0 ? (
        <>
          <TableScroll className="mt-6 rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("billing.client")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("billing.patient")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("billing.status")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t("billing.total")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t("billing.paid")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("billing.dueDate")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("billing.created")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {t("billing.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    isExpanded={expandedId === invoice.id}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === invoice.id ? null : invoice.id
                      )
                    }
                    onStatusChange={handleStatusChange}
                    onConvertEstimate={handleConvertEstimate}
                    onVoidInvoice={handleVoidInvoice}
                    practiceName={verifiedBillingConfig.practiceName}
                    language={language}
                    billingTimeZone={billingTimeZone}
                    canManageBilling={canManageBilling}
                    isMutating={
                      updateStatus.isPending ||
                      convertEstimate.isPending ||
                      voidInvoice.isPending
                    }
                  />
                ))}
              </tbody>
            </table>
          </TableScroll>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <p>
                {t("billing.showing")} {offset + 1}--{Math.min(offset + limit, data.total)} {t("billing.of")} {" "}
              {data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                {t("billing.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= data.total}
                onClick={() => setOffset(offset + limit)}
              >
                {t("billing.next")}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          className="mt-6"
          icon={FileText}
          title={
            tab.isEstimate
              ? t("billing.noEstimates")
              : statusFilter
                ? t("billing.noInvoicesStatus")
                : t("billing.noInvoices")
          }
          description={
            tab.isEstimate
              ? t("billing.noEstimatesDescription")
              : statusFilter
                ? t("billing.noInvoicesStatusDescription")
                : t("billing.noInvoicesDescription")
          }
          action={
            canManageBilling
              ? {
                  label: tab.isEstimate ? t("billing.createEstimate") : t("billing.createInvoice"),
                  onClick: () => router.push("/billing/new"),
                  icon: Plus,
                }
              : undefined
          }
        />
      )}

      <ActionConfirmationDialog
        open={pendingInvoiceVoidId !== null}
        title={t("billing.voidInvoice")}
        description={t("billing.voidInvoiceDescription")}
        confirmLabel={t("billing.voidInvoice")}
        confirmVariant="destructive"
        isPending={voidInvoice.isPending}
        reason={{
          label: t("billing.voidReason"),
          value: invoiceVoidReason,
          onChange: setInvoiceVoidReason,
          placeholder: t("billing.reasonForAudit"),
          minLength: BILLING_ACTION_REASON_MIN_LENGTH,
          maxLength: BILLING_ACTION_REASON_MAX_LENGTH,
        }}
        onCancel={closeInvoiceVoidDialog}
        onConfirm={confirmInvoiceVoid}
      />
    </div>
  );
}

function DispenseChargeQueuePanel({
  canManage,
  canWaive,
  billingTimeZone,
  onInvoiceCreated,
}: {
  canManage: boolean;
  canWaive: boolean;
  billingTimeZone?: string | null;
  onInvoiceCreated: (invoiceId: string) => void;
}) {
  const t = useTranslations();
  const locale = useLanguage() === "es" ? "es-CR" : "en-US";
  const router = useRouter();
  const formatCurrency = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const [waiveTargetId, setWaiveTargetId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [legacyReviewTargetId, setLegacyReviewTargetId] = useState<
    string | null
  >(null);
  const pending = trpc.billing.listDispenseChargeQueue.useQuery({
    status: "pending",
    limit: 50,
    offset: 0,
  });
  const waived = trpc.billing.listDispenseChargeQueue.useQuery(
    { status: "waived", limit: 25, offset: 0 },
    { enabled: canWaive },
  );
  const createInvoice = trpc.billing.createDispenseChargeInvoice.useMutation({
    onSuccess: async ({ invoiceId }) => {
      toast.success(t("billing.dispenseAdded"));
      onInvoiceCreated(invoiceId);
      await Promise.all([
        utils.billing.listDispenseChargeQueue.invalidate(),
        utils.billing.listInvoices.invalidate(),
      ]);
      router.push(`/billing?expand=${invoiceId}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const waiveCharge = trpc.billing.waiveDispenseCharge.useMutation({
    onSuccess: async () => {
      toast.success(t("billing.dispenseWaived"));
      await utils.billing.listDispenseChargeQueue.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const reopenCharge = trpc.billing.reopenDispenseCharge.useMutation({
    onSuccess: async () => {
      toast.success(t("billing.dispenseReturned"));
      await utils.billing.listDispenseChargeQueue.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const isMutating =
    createInvoice.isPending || waiveCharge.isPending || reopenCharge.isPending;

  function openWaiveDialog(id: string) {
    setWaiveReason("");
    setWaiveTargetId(id);
  }

  function closeWaiveDialog() {
    if (waiveCharge.isPending) return;
    setWaiveTargetId(null);
    setWaiveReason("");
  }

  function confirmWaive() {
    const reason = waiveReason.trim();
    if (!waiveTargetId || reason.length < BILLING_ACTION_REASON_MIN_LENGTH) {
      return;
    }
    waiveCharge.mutate(
      { id: waiveTargetId, reason },
      {
        onSuccess: () => {
          setWaiveTargetId(null);
          setWaiveReason("");
        },
      },
    );
  }

  function createDraftForDispense(item: { id: string; legacyReview: boolean }) {
    if (item.legacyReview) {
      setLegacyReviewTargetId(item.id);
      return;
    }
    createInvoice.mutate({
      id: item.id,
      acknowledgeLegacyReview: false,
    });
  }

  function closeLegacyReviewDialog() {
    if (createInvoice.isPending) return;
    setLegacyReviewTargetId(null);
  }

  function confirmLegacyReview() {
    if (!legacyReviewTargetId) return;
    createInvoice.mutate(
      {
        id: legacyReviewTargetId,
        acknowledgeLegacyReview: true,
      },
      { onSuccess: () => setLegacyReviewTargetId(null) },
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border p-4">
        <div>
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" />
            <h3 className="font-heading font-semibold">
              {t("billing.unbilledDispenses")}
            </h3>
            {pending.data ? (
              <Badge
                variant={pending.data.total > 0 ? "destructive" : "secondary"}
              >
                {pending.data.total}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("billing.dispenseQueueDescription")}
          </p>
        </div>
      </div>
      {pending.isError ? (
        <div className="p-4 text-sm text-destructive">
          {t("billing.dispenseLoadError")} {pending.error.message}
        </div>
      ) : pending.isLoading ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("billing.dispenseWorkLoading")}
        </div>
      ) : pending.data && pending.data.items.length > 0 ? (
        <div className="divide-y divide-border">
          {pending.data.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.description}</p>
                  {item.legacyReview ? (
                    <Badge variant="outline">{t("billing.legacyReview")}</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.patientName} · {item.clientFirstName}{" "}
                  {item.clientLastName} · {t("billing.quantityAt")} {item.quantity} {" "}
                  {formatCurrency(item.unitPrice)} · {t("billing.dispensed")} {" "}
                  {formatBillingInstantDate(item.createdAt, billingTimeZone, locale)}
                  {item.appointmentId ? (
                    <>
                      {" "}·{" "}
                      <Link
                        href={`/encounters/${item.appointmentId}#charge-capture`}
                        className="underline underline-offset-2"
                      >
                        {t("billing.openVisit")}
                      </Link>
                    </>
                  ) : (
                    <> · {t("billing.standaloneRefill")}</>
                  )}
                </p>
              </div>
              {canManage ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={isMutating}
                    onClick={() => createDraftForDispense(item)}
                  >
                    {item.legacyReview ? t("billing.reviewCreate") : t("billing.createDraft")}
                  </Button>
                  {canWaive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isMutating}
                      onClick={() => openWaiveDialog(item.id)}
                    >
                      {t("billing.waive")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-green-600" />
          {t("billing.noWaitingDispenses")}
        </div>
      )}
      {canWaive && waived.data && waived.data.items.length > 0 ? (
        <details className="border-t border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("billing.recentlyWaived")} ({waived.data.total})
          </summary>
          <div className="mt-3 space-y-3">
            {waived.data.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-muted-foreground">
                    {item.patientName} · {item.resolutionReason}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isMutating}
                  onClick={() => reopenCharge.mutate({ id: item.id })}
                >
                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                  {t("billing.reopen")}
                </Button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <ActionConfirmationDialog
        open={legacyReviewTargetId !== null}
        title={t("billing.reviewLegacyDispense")}
        description={t("billing.reviewLegacyDispenseDescription")}
        confirmLabel={t("billing.verifiedCreateDraft")}
        isPending={createInvoice.isPending}
        onCancel={closeLegacyReviewDialog}
        onConfirm={confirmLegacyReview}
      />

      <ActionConfirmationDialog
        open={waiveTargetId !== null}
        title={t("billing.waiveMedicationCharge")}
        description={t("billing.waiveMedicationChargeDescription")}
        confirmLabel={t("billing.waiveCharge")}
        confirmVariant="destructive"
        isPending={waiveCharge.isPending}
        reason={{
          label: t("billing.noChargeReason"),
          value: waiveReason,
          onChange: setWaiveReason,
          placeholder: t("billing.waiveReasonPlaceholder"),
          minLength: BILLING_ACTION_REASON_MIN_LENGTH,
          maxLength: BILLING_ACTION_REASON_MAX_LENGTH,
        }}
        onCancel={closeWaiveDialog}
        onConfirm={confirmWaive}
      />

    </section>
  );
}

function WellnessBillingPanel({
  billingTimeZone,
  settingsReady,
  canManageBilling,
}: {
  billingTimeZone?: string | null;
  settingsReady: boolean;
  canManageBilling: boolean;
}) {
  const t = useTranslations();
  const locale = useLanguage() === "es" ? "es-CR" : "en-US";
  const formatCurrency = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const dueQuery = trpc.wellness.listDue.useQuery(undefined, {
    enabled: settingsReady,
    refetchOnWindowFocus: false,
  });
  const dueMembershipsMissing =
    settingsReady && !dueQuery.isLoading && !dueQuery.error && !dueQuery.data;
  const dueMembershipsUnavailable =
    !!dueQuery.error || dueMembershipsMissing;
  const verifiedDueMemberships =
    dueQuery.isLoading || dueMembershipsUnavailable || !dueQuery.data
      ? null
      : dueQuery.data;
  const dueMemberships = verifiedDueMemberships ?? [];
  const totalDue = verifiedDueMemberships
    ? verifiedDueMemberships.reduce(
        (sum, row) => sum + Number(row.price ?? 0),
        0
      )
    : 0;

  const generateInvoices = trpc.wellness.generateDueInvoices.useMutation({
    onSuccess: (result) => {
      const label = result.generated === 1
        ? t("billing.wellnessGeneratedSingular")
        : t("billing.wellnessGeneratedPlural");
      toast.success(`${result.generated} ${label}`);
      utils.wellness.listDue.invalidate();
      utils.billing.listInvoices.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (
    !settingsReady ||
    (!dueQuery.isLoading &&
      !dueQuery.error &&
      !dueMembershipsMissing &&
      dueMemberships.length === 0)
  ) {
    return null;
  }

  return (
    <div
      className={`mt-6 rounded-lg border ${
        dueMembershipsUnavailable
          ? "border-destructive bg-destructive/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{t("billing.wellnessInvoicesDue")}</h3>
              <Badge variant="secondary">{t("billing.invoiceSchedule")}</Badge>
            </div>
            <p
              className={`text-sm ${
                dueMembershipsUnavailable
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {dueQuery.isLoading
                ? t("billing.wellnessChecking")
                : dueQuery.error
                ? dueQuery.error.message
                : dueMembershipsMissing
                ? t("billing.wellnessLoadError")
                : `${dueMemberships.length} ${dueMemberships.length === 1 ? t("billing.scheduledInvoice") : t("billing.scheduledInvoices")} ${t("billing.dueBeforeTax").replace("{amount}", formatCurrency(totalDue))}`}
            </p>
            {!dueMembershipsUnavailable && !dueQuery.isLoading && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("billing.wellnessDescription")}
              </p>
            )}
          </div>
        </div>
        {canManageBilling && (
          <Button
            size="sm"
            disabled={
              dueQuery.isLoading ||
              dueMembershipsUnavailable ||
              dueMemberships.length === 0 ||
              generateInvoices.isPending
            }
            onClick={() =>
              generateInvoices.mutate({
                enrollmentIds: dueMemberships.map((row) => row.enrollmentId),
              })
            }
          >
            {generateInvoices.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {t("billing.generateInvoices")}
          </Button>
        )}
      </div>
      {dueMemberships.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("billing.client")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("billing.patient")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("billing.plan")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("billing.dueDate")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t("billing.amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {dueMemberships.map((row) => (
                <tr
                  key={row.enrollmentId}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-medium">
                    {row.clientFirstName} {row.clientLastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.patientName || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.planName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatBillingDateInput(
                      row.nextBillingDate,
                      billingTimeZone,
                      locale
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(row.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({
  invoice,
  isExpanded,
  onToggle,
  onStatusChange,
  onConvertEstimate,
  onVoidInvoice,
  practiceName,
  language,
  billingTimeZone,
  canManageBilling,
  isMutating,
}: {
  invoice: {
    id: string;
    status: string;
    subtotal: string | null;
    tax: string | null;
    total: string | null;
    paidAmount: string | null;
    adjustedAmount?: string | null;
    dueDate: string | null;
    createdAt: Date | string | null;
    isEstimate: boolean;
    appointmentId: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
    patientName: string | null;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (
    e: React.MouseEvent,
    id: string,
    status: "sent"
  ) => void;
  onConvertEstimate: (e: React.MouseEvent, id: string) => void;
  onVoidInvoice: (e: React.MouseEvent, id: string) => void;
  practiceName: string;
  language: "en" | "es";
  billingTimeZone?: string | null;
  canManageBilling: boolean;
  isMutating: boolean;
}) {
  const t = useTranslations();
  const locale = useLanguage() === "es" ? "es-CR" : "en-US";
  const formatCurrency = useCurrencyFormatter();
  const detail = trpc.billing.getInvoice.useQuery(
    { id: invoice.id },
    { enabled: isExpanded }
  );

  const displayStatus = getDisplayStatus(invoice);
  const adjustedAmount = Number(invoice.adjustedAmount ?? 0);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
      >
        <td className="px-2 py-3 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-medium">
          {invoice.clientFirstName} {invoice.clientLastName}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {invoice.patientName || "\u2014"}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${displayStatus.style}`}
          >
            {t(displayStatus.label as Parameters<Translator>[0])}
          </span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {formatCurrency(invoice.total)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          <span>{formatCurrency(invoice.paidAmount)}</span>
          {adjustedAmount > 0 && (
            <span className="block text-xs text-muted-foreground">
              {t("billing.adjustedShort")} {formatCurrency(adjustedAmount)}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {invoice.dueDate
            ? formatBillingDateInput(invoice.dueDate, billingTimeZone, locale)
            : "\u2014"}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {invoice.createdAt
            ? formatBillingInstantDate(invoice.createdAt, billingTimeZone, locale)
            : "\u2014"}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {canManageBilling && invoice.isEstimate && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isMutating}
                onClick={(e) => onConvertEstimate(e, invoice.id)}
                title={t("billing.convertToInvoice")}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {canManageBilling &&
              !invoice.isEstimate &&
              invoice.status === "draft" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isMutating}
                onClick={(e) => onStatusChange(e, invoice.id, "sent")}
                title={t("billing.markAsSent")}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
            {canManageBilling &&
              !invoice.isEstimate &&
              (invoice.status === "sent" || invoice.status === "overdue") && (
                <>
                  {invoice.status === "sent" ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isMutating}
                      onClick={(e) => onStatusChange(e, invoice.id, "sent")}
                      title={t("billing.markAsSent")}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
            {canManageBilling &&
              invoice.status !== "paid" &&
              invoice.status !== "void" && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMutating}
                  onClick={(e) => onVoidInvoice(e, invoice.id)}
                  title={t("billing.voidInvoice")}
                >
                  <Ban className="h-3.5 w-3.5" />
                </Button>
              )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border last:border-0">
          <td colSpan={9} className="bg-muted/20 px-8 py-4" data-tour="invoice-detail">
            {detail.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("billing.loadingInvoiceDetails")}
              </div>
            ) : detail.data ? (
              <div className="space-y-4">
                {detail.data.appointmentId ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/encounters/${encodeURIComponent(detail.data.appointmentId)}#charge-capture`}
                    >
                      {t("billing.backToVisit")}
                    </Link>
                  </Button>
                ) : null}

                {/* Estimate Approval Card */}
                {invoice.isEstimate && (
                  <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        {t("billing.thisIsEstimate")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const d = detail.data!;
                          const clientName = [d.clientFirstName, d.clientLastName]
                            .filter(Boolean)
                            .join(" ");
                          const { generateInvoicePdf } = await import("@/lib/pdf");
                          generateInvoicePdf({
                            practiceName,
                            language,
                            clientName,
                            clientEmail: d.clientEmail ?? undefined,
                            patientName: d.patientName ?? undefined,
                            invoiceDate: d.createdAt
                              ? formatBillingInstantDate(
                                  d.createdAt,
                                  billingTimeZone,
                                  locale
                                )
                              : formatBillingInstantDate(
                                  new Date(),
                                  billingTimeZone,
                                  locale
                                ),
                            dueDate: d.dueDate
                              ? formatBillingDateInput(
                                  d.dueDate,
                                  billingTimeZone,
                                  locale
                                )
                              : undefined,
                            status: "estimate",
                            items: d.items.map((item) => ({
                              description: item.description ?? "",
                              quantity: Number(item.quantity ?? 1),
                              unitPrice: formatCurrency(item.unitPrice),
                              total: formatCurrency(item.total),
                            })),
                            subtotal: formatCurrency(d.subtotal),
                            tax: formatCurrency(d.tax),
                            total: formatCurrency(d.total),
                            paidAmount: formatCurrency(d.paidAmount),
                            balanceDue: formatCurrency(d.balanceDue),
                          }).save(`estimate-${clientName || "unknown"}.pdf`);
                        }}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        {t("billing.presentToClient")}
                      </Button>
                      {canManageBilling && (
                        <Button
                          size="sm"
                          disabled={isMutating}
                          onClick={(e) => onConvertEstimate(e, invoice.id)}
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          {t("billing.approveConvert")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground">
                    {t("billing.clientLabel")}{" "}
                    <span className="text-foreground font-medium">
                      {detail.data.clientFirstName}{" "}
                      {detail.data.clientLastName}
                    </span>
                  </span>
                  {detail.data.clientEmail && (
                    <span className="text-muted-foreground">
                      {detail.data.clientEmail}
                    </span>
                  )}
                </div>
                {detail.data.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium text-muted-foreground">
                        {t("billing.description")}
                        </th>
                        <th className="py-2 text-left font-medium text-muted-foreground">
                        {t("billing.type")}
                        </th>
                        <th className="py-2 text-right font-medium text-muted-foreground">
                        {t("billing.qty")}
                        </th>
                        <th className="py-2 text-right font-medium text-muted-foreground">
                        {t("billing.unitPrice")}
                        </th>
                        <th className="py-2 text-right font-medium text-muted-foreground">
                        {t("billing.total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2">{item.description}</td>
                          <td className="py-2 capitalize text-muted-foreground">
                            {(item.itemType === "service"
                              ? t("billing.service")
                              : t("billing.product"))} · {item.taxable ? t("billing.taxableItem") : t("billing.notTaxableItem")}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td colSpan={4} className="py-2 text-right font-medium">
                          {t("billing.subtotal")}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(detail.data.subtotal)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-1 text-right text-muted-foreground">
                          {t("billing.tax")}
                        </td>
                        <td className="py-1 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(detail.data.tax)}
                        </td>
                      </tr>
                      <tr className="font-semibold">
                        <td colSpan={4} className="py-2 text-right">
                          {t("billing.total")}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(detail.data.total)}
                        </td>
                      </tr>
                    </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("billing.noLineItems")}
                  </p>
                )}

                {/* Balance Summary */}
                {!invoice.isEstimate && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                    <div className="flex items-center gap-6">
                      <span>
                        {t("billing.totalLabel")}{" "}
                        <span className="font-semibold">
                          {formatCurrency(detail.data.total)}
                        </span>
                      </span>
                      <span>
                        {t("billing.paidLabel")}{" "}
                        <span className="font-semibold text-green-600">
                          {formatCurrency(detail.data.paidAmount)}
                        </span>
                      </span>
                      {Number(detail.data.adjustedAmount ?? 0) > 0 && (
                        <span>
                          {t("billing.adjustedLabel")}{" "}
                          <span className="font-semibold text-teal-600">
                            {formatCurrency(detail.data.adjustedAmount)}
                          </span>
                        </span>
                      )}
                      <span>
                        {t("billing.balanceLabel")}{" "}
                        <span className="font-semibold text-red-600">
                          {formatCurrency(detail.data.balanceDue)}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const d = detail.data!;
                          const clientName = [d.clientFirstName, d.clientLastName]
                            .filter(Boolean)
                            .join(" ");
                          const { generateInvoicePdf } = await import("@/lib/pdf");
                          generateInvoicePdf({
                            practiceName,
                            language,
                            clientName,
                            clientEmail: d.clientEmail ?? undefined,
                            patientName: d.patientName ?? undefined,
                            invoiceDate: d.createdAt
                              ? formatBillingInstantDate(
                                  d.createdAt,
                                  billingTimeZone,
                                  locale
                                )
                              : formatBillingInstantDate(
                                  new Date(),
                                  billingTimeZone,
                                  locale
                                ),
                            dueDate: d.dueDate
                              ? formatBillingDateInput(
                                  d.dueDate,
                                  billingTimeZone,
                                  locale
                                )
                              : undefined,
                            status: d.status,
                            items: d.items.map((item) => ({
                              description: item.description ?? "",
                              quantity: Number(item.quantity ?? 1),
                              unitPrice: formatCurrency(item.unitPrice),
                              total: formatCurrency(item.total),
                            })),
                            subtotal: formatCurrency(d.subtotal),
                            tax: formatCurrency(d.tax),
                            total: formatCurrency(d.total),
                            paidAmount: formatCurrency(d.paidAmount),
                            balanceDue: formatCurrency(d.balanceDue),
                          }).save(`invoice-${clientName || "unknown"}.pdf`);
                        }}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        {t("billing.downloadPdf")}
                      </Button>
                      {canManageBilling &&
                        (invoice.status === "sent" ||
                          invoice.status === "overdue") && (
                        <EmailInvoiceButton invoiceId={invoice.id} />
                      )}
                    </div>
                  </div>
                )}

                {/* Payment History & Record Payment */}
                {!invoice.isEstimate && (
                  <PaymentSection
                    invoiceId={invoice.id}
                    invoicePaidAmount={detail.data.paidAmount}
                    invoiceAdjustedAmount={detail.data.adjustedAmount}
                    invoiceBalanceDue={detail.data.balanceDue}
                    invoiceDueDate={detail.data.dueDate}
                    invoiceStatus={invoice.status}
                    billingTimeZone={billingTimeZone}
                    canManageBilling={canManageBilling}
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                  {t("billing.failedInvoiceDetails")}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function EmailInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations();
  const sendInvoiceEmail = trpc.notifications.sendInvoiceEmail.useMutation({
    onSuccess: () => {
      toast.success(t("billing.emailInvoice"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={sendInvoiceEmail.isPending}
      onClick={(e) => {
        e.stopPropagation();
        sendInvoiceEmail.mutate({ invoiceId });
      }}
    >
      {sendInvoiceEmail.isPending ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Mail className="mr-1 h-3.5 w-3.5" />
      )}
      {t("billing.emailInvoice")}
    </Button>
  );
}

function PaymentSection({
  invoiceId,
  invoicePaidAmount,
  invoiceAdjustedAmount,
  invoiceBalanceDue,
  invoiceDueDate,
  invoiceStatus,
  billingTimeZone,
  canManageBilling,
}: {
  invoiceId: string;
  invoicePaidAmount: string | null;
  invoiceAdjustedAmount: string | null;
  invoiceBalanceDue: string | null;
  invoiceDueDate: string | null;
  invoiceStatus: string;
  billingTimeZone?: string | null;
  canManageBilling: boolean;
}) {
  const t = useTranslations();
  const locale = useLanguage() === "es" ? "es-CR" : "en-US";
  const formatCurrency = useCurrencyFormatter();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "write_off">(
    "credit"
  );
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [refundTarget, setRefundTarget] = useState<{
    paymentId: string;
    amount: string;
  } | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundDueDate, setRefundDueDate] = useState("");
  const paymentOperationId = useRef<string | null>(null);
  const adjustmentOperationId = useRef<string | null>(null);

  const utils = trpc.useUtils();

  const paymentsQuery = trpc.billing.listPayments.useQuery({ invoiceId });
  const adjustmentsQuery = trpc.billing.listAdjustments.useQuery({ invoiceId });
  const cardPaymentStatus = trpc.billing.cardPaymentStatus.useQuery(undefined, {
    enabled: canManageBilling,
    staleTime: 60_000,
  });

  const recordPayment = trpc.billing.recordPayment.useMutation({
    onSuccess: () => {
      toast.success(t("billing.paymentRecorded"));
      utils.billing.listPayments.invalidate({ invoiceId });
      utils.billing.listInvoices.invalidate();
      utils.billing.getInvoice.invalidate({ id: invoiceId });
      setShowPaymentForm(false);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentNotes("");
      paymentOperationId.current = null;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const applyAdjustment = trpc.billing.applyInvoiceAdjustment.useMutation({
    onSuccess: () => {
      toast.success(t("billing.adjustmentApplied"));
      utils.billing.listAdjustments.invalidate({ invoiceId });
      utils.billing.listInvoices.invalidate();
      utils.billing.getInvoice.invalidate({ id: invoiceId });
      setShowAdjustmentForm(false);
      setAdjustmentType("credit");
      setAdjustmentAmount("");
      setAdjustmentReason("");
      adjustmentOperationId.current = null;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const cardCheckout = trpc.billing.createCardPaymentCheckout.useMutation({
    onSuccess: ({ url }) => {
      if (!isSafeCheckoutRedirectUrl(url)) {
      toast.error(t("billing.cardUnavailable"));
        return;
      }
      window.location.href = url;
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const refundPayment = trpc.billing.refundPayment.useMutation({
    onSuccess: () => {
      toast.success(t("billing.paymentRefunded"));
      setRefundTarget(null);
      setRefundReason("");
      setRefundDueDate("");
      utils.billing.listPayments.invalidate({ invoiceId });
      utils.billing.listInvoices.invalidate();
      utils.billing.getInvoice.invalidate({ id: invoiceId });
      utils.billing.arSummary.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const { data: paymentSession } = useSession();
  const canRefund = paymentSession?.user?.role === "admin";

  const remaining = Math.max(0, Number(invoiceBalanceDue ?? 0));
  const amountInputMax = Math.min(remaining, BILLING_UNIT_PRICE_MAX);
  const canCollect =
    canManageBilling &&
    (invoiceStatus === "sent" || invoiceStatus === "overdue") &&
    remaining > 0;
  const cardPaymentStatusMissing =
    canManageBilling &&
    !cardPaymentStatus.isLoading &&
    !cardPaymentStatus.error &&
    !cardPaymentStatus.data;
  const verifiedCardPaymentStatus =
    cardPaymentStatus.isLoading ||
    cardPaymentStatus.error ||
    cardPaymentStatusMissing ||
    !cardPaymentStatus.data
      ? null
      : cardPaymentStatus.data;
  const cardPaymentsEnabled = verifiedCardPaymentStatus
    ? verifiedCardPaymentStatus.enabled === true
    : false;
  const cardPaymentsUnavailable =
    cardPaymentStatus.isError ||
    cardPaymentStatusMissing ||
    (verifiedCardPaymentStatus ? !verifiedCardPaymentStatus.enabled : false);
  const canRecordPayment =
    canManageBilling &&
    isBillingAmountWithinBalance(paymentAmount, invoiceBalanceDue) &&
    paymentNotes.trim().length <= BILLING_NOTES_MAX_LENGTH &&
    !recordPayment.isPending;
  const canApplyAdjustment =
    canManageBilling &&
    isBillingAmountWithinBalance(adjustmentAmount, invoiceBalanceDue) &&
    adjustmentReason.trim().length <= BILLING_ADJUSTMENT_REASON_MAX_LENGTH &&
    !applyAdjustment.isPending;

  const handleOpenForm = () => {
    paymentOperationId.current = null;
    setPaymentAmount(remaining.toFixed(2));
    setShowPaymentForm(true);
  };

  const handleOpenAdjustmentForm = () => {
    adjustmentOperationId.current = null;
    setAdjustmentAmount(remaining.toFixed(2));
    setShowAdjustmentForm(true);
  };

  const handleRecordPayment = () => {
    if (!canRecordPayment) return;
    paymentOperationId.current ??= crypto.randomUUID();
    recordPayment.mutate({
      invoiceId,
      operationId: paymentOperationId.current,
      amount: paymentAmount.trim(),
      method: paymentMethod as any,
      notes: paymentNotes.trim() || undefined,
    });
  };

  const handleApplyAdjustment = () => {
    if (!canApplyAdjustment) return;
    adjustmentOperationId.current ??= crypto.randomUUID();
    applyAdjustment.mutate({
      invoiceId,
      operationId: adjustmentOperationId.current,
      type: adjustmentType,
      amount: adjustmentAmount.trim(),
      reason: adjustmentReason.trim() || undefined,
    });
  };

  const closeRefundDialog = () => {
    if (refundPayment.isPending) return;
    setRefundTarget(null);
    setRefundReason("");
    setRefundDueDate("");
  };

  const confirmRefund = () => {
    if (
      !refundTarget ||
      refundReason.trim().length < BILLING_ACTION_REASON_MIN_LENGTH
    ) {
      return;
    }
    refundPayment.mutate({
      paymentId: refundTarget.paymentId,
      reason: refundReason.trim(),
      dueDate: refundDueDate || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-medium">{t("billing.paymentsAdjustments")}</h4>
        {canCollect && (
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleOpenForm}
            >
              <DollarSign className="mr-1 h-3.5 w-3.5" />
              {t("billing.recordPayment")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={
                cardCheckout.isPending ||
                cardPaymentStatus.isLoading ||
                !cardPaymentsEnabled
              }
              onClick={() => cardCheckout.mutate({ invoiceId })}
              title={
                cardPaymentsUnavailable
                ? t("billing.cardPaymentsNotConfigured")
                : t("billing.takeCardPayment")
              }
            >
              {cardCheckout.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CreditCard className="mr-1 h-3.5 w-3.5" />
              )}
              {t("billing.takeCard")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleOpenAdjustmentForm}
            >
              <DollarSign className="mr-1 h-3.5 w-3.5" />
              {t("billing.credit")} / {t("billing.writeOff")}
            </Button>
          </div>
        )}
      </div>

      {canCollect && cardPaymentsUnavailable && (
        <p className="text-xs text-muted-foreground">
          {t("billing.cardUnavailable")}
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{t("billing.paidAmount")} {formatCurrency(invoicePaidAmount)}</span>
        <span>{t("billing.adjustedAmount")} {formatCurrency(invoiceAdjustedAmount)}</span>
        <span>{t("billing.balanceAmount")} {formatCurrency(invoiceBalanceDue)}</span>
      </div>

      {/* Payment form */}
      {showPaymentForm && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("billing.amount")}
              </label>
              <Input
                type="number"
                step="0.01"
                min={BILLING_PAYMENT_AMOUNT_MIN}
                max={amountInputMax}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("billing.method")}
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("billing.notesOptional")}
              </label>
              <Input
                value={paymentNotes}
                maxLength={BILLING_NOTES_MAX_LENGTH}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder={t("billing.referencePlaceholder")}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleRecordPayment}
              disabled={!canRecordPayment}
            >
                  {recordPayment.isPending ? t("billing.recording") : t("billing.recordPayment")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                paymentOperationId.current = null;
                setShowPaymentForm(false);
              }}
            >
              {t("billing.cancel")}
            </Button>
          </div>
          {recordPayment.isError && (
            <p className="text-xs text-destructive">
              {recordPayment.error.message}
            </p>
          )}
        </div>
      )}

      {showAdjustmentForm && (
        <div className="space-y-3 rounded-lg border border-border bg-background p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("billing.status")}
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={adjustmentType}
                onChange={(e) =>
                  setAdjustmentType(e.target.value as "credit" | "write_off")
                }
              >
                <option value="credit">{t("billing.credit")}</option>
                <option value="write_off">{t("billing.writeOff")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("billing.amount")}
              </label>
              <Input
                type="number"
                step="0.01"
                min={BILLING_PAYMENT_AMOUNT_MIN}
                max={amountInputMax}
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t("billing.reason")}
              </label>
              <Input
                value={adjustmentReason}
                maxLength={BILLING_ADJUSTMENT_REASON_MAX_LENGTH}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder={t("billing.adjustmentReasonPlaceholder")}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleApplyAdjustment}
              disabled={!canApplyAdjustment}
            >
              {applyAdjustment.isPending ? t("billing.applying") : t("billing.applyAdjustment")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                adjustmentOperationId.current = null;
                setShowAdjustmentForm(false);
              }}
            >
              {t("billing.cancel")}
            </Button>
          </div>
          {applyAdjustment.isError && (
            <p className="text-xs text-destructive">
              {applyAdjustment.error.message}
            </p>
          )}
        </div>
      )}

      {/* Payment list */}
      {paymentsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">{t("billing.loadingPayments")}</p>
      ) : paymentsQuery.data && paymentsQuery.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.date")}
              </th>
              <th className="py-2 text-right font-medium text-muted-foreground">
                {t("billing.amount")}
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.method")}
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.receivedBy")}
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.notes")}
              </th>
              {canRefund && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {paymentsQuery.data.map((payment) => (
              <tr
                key={payment.id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 text-muted-foreground">
                  {payment.receivedAt
                    ? formatBillingInstantDate(
                        payment.receivedAt,
                        billingTimeZone,
                        locale
                      )
                    : "\u2014"}
                </td>
                <td
                  className={`py-2 text-right tabular-nums font-medium ${
                    Number(payment.amount) < 0
                      ? "text-destructive"
                      : "text-green-600"
                  }`}
                >
                  {formatCurrency(payment.amount)}
                </td>
                <td className="py-2 capitalize text-muted-foreground">
                  {(() => {
                    const method = PAYMENT_METHODS.find(
                      (option) => option.value === payment.method
                    );
                    return method ? t(method.labelKey) : payment.method ?? "\u2014";
                  })()}
                </td>
                <td className="py-2 text-muted-foreground">
                  {payment.receivedByName ?? "\u2014"}
                </td>
                <td className="py-2 text-muted-foreground">
                  {payment.notes || "\u2014"}
                </td>
                {canRefund && (
                  <td className="py-2 text-right">
                    {Number(payment.amount) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        disabled={refundPayment.isPending}
                        onClick={() => {
                          setRefundReason("");
                          setRefundDueDate(invoiceDueDate ?? "");
                          setRefundTarget({
                            paymentId: payment.id,
                            amount: payment.amount,
                          });
                        }}
                      >
                        {t("billing.refund")}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("billing.noPayments")}</p>
      )}

      {adjustmentsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">{t("billing.loadingAdjustments")}</p>
      ) : adjustmentsQuery.data && adjustmentsQuery.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.date")}
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.typeLabel")}
              </th>
              <th className="py-2 text-right font-medium text-muted-foreground">
                {t("billing.amount")}
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.createdBy")}
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                {t("billing.reason")}
              </th>
            </tr>
          </thead>
          <tbody>
            {adjustmentsQuery.data.map((adjustment) => (
              <tr
                key={adjustment.id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 text-muted-foreground">
                  {adjustment.createdAt
                    ? formatBillingInstantDate(
                        adjustment.createdAt,
                        billingTimeZone,
                        locale
                      )
                    : "\u2014"}
                </td>
                <td className="py-2 capitalize text-muted-foreground">
                  {adjustment.type === "credit"
                    ? t("billing.credit")
                    : adjustment.type === "write_off"
                      ? t("billing.writeOff")
                    : t("billing.other")}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-teal-600">
                  {formatCurrency(adjustment.amount)}
                </td>
                <td className="py-2 text-muted-foreground">
                  {adjustment.createdByName ?? "\u2014"}
                </td>
                <td className="py-2 text-muted-foreground">
                  {adjustment.reason || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("billing.noCredits")}
        </p>
      )}
      <ActionConfirmationDialog
        open={refundTarget !== null}
        title={t("billing.refundPayment")}
        description={t("billing.refundDescription").replace("{amount}", formatCurrency(refundTarget?.amount ?? "0"))}
        confirmLabel={t("billing.refund")}
        confirmVariant="destructive"
        isPending={refundPayment.isPending}
        reason={{
          label: t("billing.refundReason"),
          value: refundReason,
          onChange: setRefundReason,
          placeholder: t("billing.refundPlaceholder"),
          minLength: BILLING_ACTION_REASON_MIN_LENGTH,
          maxLength: BILLING_ACTION_REASON_MAX_LENGTH,
        }}
        onCancel={closeRefundDialog}
        onConfirm={confirmRefund}
      >
        <label
          htmlFor={`refund-due-date-${invoiceId}`}
          className="text-sm font-medium"
        >
          {t("billing.refundDueDate")}
        </label>
        <Input
          id={`refund-due-date-${invoiceId}`}
          type="date"
          className="mt-2"
          value={refundDueDate}
          disabled={refundPayment.isPending || Boolean(invoiceDueDate)}
          onChange={(event) => setRefundDueDate(event.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t("billing.refundDueDateHelp")}
        </p>
      </ActionConfirmationDialog>
    </div>
  );
}
