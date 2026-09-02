"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { dateLocaleForLanguage } from "@/lib/i18n/language";
import { useLanguage, useTranslations } from "@/lib/i18n/client";

type FormState = {
  entityType: "PRIVATE_PROFIT" | "NON_PROFIT";
  displayName: string;
  legalName: string;
  taxId: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  businessPhone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  website: string;
  privacyPolicyUrl: string;
  termsUrl: string;
};

const EMPTY_FORM: FormState = {
  entityType: "PRIVATE_PROFIT",
  displayName: "",
  legalName: "",
  taxId: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  businessPhone: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  website: "",
  privacyPolicyUrl: "",
  termsUrl: "",
};

export function MessagingRegistrationForm() {
  const t = useTranslations();
  const language = useLanguage();
  const utils = trpc.useUtils();
  const registrationQuery = trpc.messaging.getRegistration.useQuery();
  const defaultsQuery = trpc.messaging.getRegistrationDefaults.useQuery();
  const data = registrationQuery.data;
  const defaults = defaultsQuery.data;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [attested, setAttested] = useState(false);
  const appliedInitialValues = useRef(false);

  useEffect(() => {
    if (appliedInitialValues.current) return;
    if (data) {
      setForm({
        entityType: data.entityType,
        displayName: data.displayName,
        legalName: data.legalName,
        taxId: "",
        contactFirstName: data.contactFirstName,
        contactLastName: data.contactLastName,
        contactEmail: data.contactEmail,
        businessPhone: data.businessPhone,
        street: data.street,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        website: data.website,
        privacyPolicyUrl: data.privacyPolicyUrl,
        termsUrl: data.termsUrl,
      });
      appliedInitialValues.current = true;
      return;
    }
    if (data === null && defaults) {
      setForm((current) => ({
        ...current,
        displayName: defaults.displayName,
        contactFirstName: defaults.contactFirstName,
        contactLastName: defaults.contactLastName,
        contactEmail: defaults.contactEmail,
        businessPhone: defaults.businessPhone,
        website: defaults.website,
        privacyPolicyUrl: defaults.privacyPolicyUrl,
        termsUrl: defaults.termsUrl,
      }));
      appliedInitialValues.current = true;
    }
  }, [data, defaults]);

  const submitted = Boolean(
    data?.providerBrandStatus || data?.providerCampaignStatus,
  );
  const save = trpc.messaging.saveRegistration.useMutation({
    onSuccess: () => {
      toast.success(
        t("messaging.detailsSaved"),
      );
      setForm((current) => ({ ...current, taxId: "" }));
      setAttested(false);
      utils.messaging.getRegistration.invalidate();
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  if (registrationQuery.isLoading || defaultsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("messaging.loadingCarrier")}
      </div>
    );
  }
  const queryError = registrationQuery.error || defaultsQuery.error;
  if (queryError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertTriangle className="mr-2 inline h-4 w-4" /> {queryError.message}
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
            <h3 className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" /> {t("messaging.registrationTitle")}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("messaging.registrationDescription")}
          </p>
        </div>
        {data ? (
          <Badge
            variant={
              data.status === "active"
                ? "success"
                : data.status === "action_required" || data.status === "pending"
                  ? "warning"
                  : data.status === "failed" || data.status === "suspended"
                    ? "destructive"
                    : "secondary"
            }
          >
            {data.status === "active"
              ? t("messaging.active")
              : data.status === "action_required"
                ? t("messaging.actionRequired")
                : data.status === "pending"
                  ? t("messaging.registrationPending")
                  : data.status === "failed"
                    ? t("messaging.failed")
                    : data.status === "suspended"
                      ? t("messaging.suspended")
                      : t("messaging.notStarted")}
          </Badge>
        ) : null}
      </div>

      {data?.statusDetail ? (
        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          {data.status === "active" ? (
            <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />
          ) : null}
          {data.statusDetail}
          {data.lastSyncedAt
            ? ` ${t("messaging.registrationDetailChecked").replace("{date}", new Date(data.lastSyncedAt).toLocaleString(dateLocaleForLanguage(language)))} `
            : ""}
        </div>
      ) : null}

      {defaults ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground">
            {t("messaging.policiesReady")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("messaging.policyDescription")}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <a
              href={defaults.privacyPolicyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("messaging.privacyPolicy")} <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={defaults.termsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("messaging.messagingTerms")} <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={defaults.optInUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("messaging.consentDisclosure")} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("messaging.organizationType")}>
          <select
            value={form.entityType}
            onChange={(event) =>
              update(
                "entityType",
                event.target.value as FormState["entityType"],
              )
            }
            disabled={submitted}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="PRIVATE_PROFIT">
              {t("messaging.privatePractice")}
            </option>
            <option value="NON_PROFIT">{t("messaging.nonProfit")}</option>
          </select>
        </Field>
        <TextField
          label={t("messaging.clientFacingName")}
          value={form.displayName}
          onChange={(v) => update("displayName", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.legalName")}
          value={form.legalName}
          onChange={(v) => update("legalName", v)}
          disabled={submitted}
        />
        <Field
          label={`${t("messaging.taxId")}${data?.hasTaxId ? ` (••••${data.taxIdLast4})` : ""}`}
        >
          <Input
            type="password"
            autoComplete="off"
            value={form.taxId}
            onChange={(event) => update("taxId", event.target.value)}
            placeholder={
              data?.hasTaxId ? t("messaging.keepSavedValue") : "12-3456789"
            }
            disabled={submitted}
          />
        </Field>
        <TextField
          label={t("messaging.contactFirst")}
          value={form.contactFirstName}
          onChange={(v) => update("contactFirstName", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.contactLast")}
          value={form.contactLastName}
          onChange={(v) => update("contactLastName", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.contactEmail")}
          type="email"
          value={form.contactEmail}
          onChange={(v) => update("contactEmail", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.businessPhone")}
          type="tel"
          value={form.businessPhone}
          onChange={(v) => update("businessPhone", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.street")}
          value={form.street}
          onChange={(v) => update("street", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.city")}
          value={form.city}
          onChange={(v) => update("city", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.state")}
          value={form.state}
          onChange={(v) => update("state", v.toUpperCase().slice(0, 2))}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.zip")}
          value={form.postalCode}
          onChange={(v) => update("postalCode", v)}
          disabled={submitted}
        />
        <TextField
          label={t("messaging.website")}
          type="url"
          value={form.website}
          onChange={(v) => update("website", v)}
          disabled={submitted}
          description={t("messaging.websiteDescription")}
        />
        <TextField
          label={t("messaging.privacyUrl")}
          type="url"
          value={form.privacyPolicyUrl}
          onChange={(v) => update("privacyPolicyUrl", v)}
          disabled={submitted}
          description={t("messaging.leaveBlankPolicy")}
        />
        <TextField
          label={t("messaging.termsUrl")}
          type="url"
          value={form.termsUrl}
          onChange={(v) => update("termsUrl", v)}
          disabled={submitted}
          description={t("messaging.leaveBlankTerms")}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div className="space-y-2">
          <label className="flex max-w-2xl items-start gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={attested}
              onChange={(event) => setAttested(event.target.checked)}
              disabled={submitted}
              className="mt-0.5"
            />
            <span>
               {t("messaging.accuracyAttestation")}
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
             {t("messaging.taxIdStored")}
          </p>
        </div>
        <Button
          type="button"
          disabled={submitted || !attested || save.isPending}
          onClick={() =>
            save.mutate({
              ...form,
              taxId: form.taxId.trim() || undefined,
              certifyAccuracyAndConsent: true,
            })
          }
        >
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {data ? t("messaging.saveChanges") : t("messaging.saveForReview")}
        </Button>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "url";
  disabled?: boolean;
  description?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      {description ? (
        <span className="block text-xs font-normal leading-4 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </Field>
  );
}
