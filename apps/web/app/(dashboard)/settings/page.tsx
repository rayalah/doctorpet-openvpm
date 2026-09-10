"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Users,
  Calendar,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Layers,
  CreditCard,
  ImageIcon,
  Mail,
  Copy,
  MessageSquare,
  Globe,
  MapPin,
  Star,
  HeartPulse,
  Compass,
  ReceiptText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { platformBrand } from "@/lib/brand/platform-brand";
import { platformOperationalConfig } from "@/lib/brand/platform-operational-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/empty-state";
import { AccentColorPicker } from "@/components/brand/accent-color-picker";
import { MessagingTab } from "@/components/settings/messaging-tab";
import { BookingTab } from "@/components/settings/booking-tab";
import { ProviderHours } from "@/components/settings/provider-hours";
import { MigrationHelpRequest } from "@/components/onboarding/migration-help-request";
import { ServicesTab } from "@/components/settings/services-tab";
import {
  TemplateCatalogPicker,
  type TemplateCatalogItem,
} from "@/components/templates/catalog-picker";
import { useWelcome } from "@/components/welcome/welcome-provider";
import { cn, isValidEmail } from "@/lib/utils";
import { toast } from "sonner";
import { regionDefaults } from "@/lib/locale/format";
import { regionalProfileDefaultsForCountry } from "@/lib/locale/regional-profile";
import {
  PRACTICE_CURRENCY_OPTIONS,
  PRACTICE_TIMEZONES,
} from "@/lib/locale/practice-region-options";
import {
  CLINIC_REGION_OPTIONS,
  isClinicRegionCode,
  type ClinicRegionCode,
} from "@/lib/locale/clinic-regions";
import { useCurrencyFormatter } from "@/lib/locale/useCurrency";
import { useTranslations } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/messages";
import { formatDateInputForTimeZone } from "@/lib/date-input";
import { isSafeCheckoutRedirectUrl } from "@/lib/checkout-redirect";
import { trialCalendarDaysLeft } from "@/lib/billing/trial-days";
import { CloudBillingCadencePicker } from "@/components/billing/cloud-billing-cadence-picker";
import {
  billingCadenceFromQuery,
  type BillingCadence,
} from "@/lib/billing/catalog";
import {
  PRACTICE_BACKUP_JSON_MAX_BYTES,
  PRACTICE_BACKUP_JSON_SIZE_MESSAGE,
  isPracticeBackupJsonSizeValid,
} from "@/lib/backup/policy";
import {
  isWellnessPlanPriceInputValid,
  WELLNESS_PLAN_DESCRIPTION_MAX_LENGTH,
  WELLNESS_PLAN_NAME_MAX_LENGTH,
  WELLNESS_PLAN_PRICE_MAX,
  WELLNESS_PLAN_PRICE_MIN,
  WELLNESS_PLAN_PRICE_SCALE,
} from "@/lib/wellness/policy";
import {
  isTreatmentTemplateItemTotalValid,
  isTreatmentTemplateQuantityValid,
  isTreatmentTemplateUnitPriceInputValid,
  TREATMENT_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  TREATMENT_TEMPLATE_ITEM_DESCRIPTION_MAX_LENGTH,
  TREATMENT_TEMPLATE_ITEM_QUANTITY_MAX,
  TREATMENT_TEMPLATE_ITEM_QUANTITY_MIN,
  TREATMENT_TEMPLATE_MAX_ITEMS,
  TREATMENT_TEMPLATE_NAME_MAX_LENGTH,
  TREATMENT_TEMPLATE_UNIT_PRICE_MAX,
} from "@/lib/templates/policy";
import {
  CLIENT_UPLOAD_TIMEOUT_MS,
  fetchWithClientTimeout,
} from "@/lib/client-fetch";
import {
  IMAGE_UPLOAD_POLICY_MESSAGE,
  isImageUploadFileValid,
} from "@/lib/upload-policy";
import {
  selectManagedUploadFile,
  settleManagedUploadAttempt,
  type ManagedUploadAttempt,
} from "@/lib/managed-upload-attempt";
import {
  IMPORT_CSV_MAX_BYTES,
  isImportCsvSizeValid,
} from "@/lib/import/policy";
import {
  MIGRATION_SOURCES,
  MIGRATION_STEPS,
  type MigrationImportMode,
} from "@/lib/import/sources";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth-password-policy";
import {
  ACCOUNT_DELETION_REASON_MAX_LENGTH,
  APPOINTMENT_TYPE_DURATION_MAX_MINUTES,
  APPOINTMENT_TYPE_DURATION_MIN_MINUTES,
  APPOINTMENT_TYPE_NAME_MAX_LENGTH,
  LOCATION_NAME_MAX_LENGTH,
  PRACTICE_NAME_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  SETTINGS_ADDRESS_MAX_LENGTH,
  SETTINGS_EMAIL_MAX_LENGTH,
  SETTINGS_PHONE_MAX_LENGTH,
  SETTINGS_VAT_NUMBER_MAX_LENGTH,
  SETTINGS_WEBSITE_MAX_LENGTH,
  STAFF_LICENSE_NUMBER_MAX_LENGTH,
  STAFF_NAME_MAX_LENGTH,
  isValidSettingsTaxRate,
  isSupportedPracticeTimezone,
} from "@/lib/settings-policy";

// ── Types ───────────────────────────────────────────────────
type Tab =
  | "practice"
  | "locations"
  | "staff"
  | "appointmentTypes"
  | "rooms"
  | "services"
  | "data"
  | "templates"
  | "wellness"
  | "messaging"
  | "booking"
  | "billing";

const tabs: { id: Tab; labelKey: keyof typeof import("@/lib/i18n/messages").enMessages; icon: React.ElementType }[] = [
  { id: "practice", labelKey: "settings.tab.practice", icon: Settings },
  { id: "locations", labelKey: "settings.tab.locations", icon: MapPin },
  { id: "staff", labelKey: "settings.tab.staff", icon: Users },
  { id: "appointmentTypes", labelKey: "settings.tab.appointmentTypes", icon: Calendar },
  { id: "rooms", labelKey: "settings.tab.rooms", icon: DoorOpen },
  { id: "services", labelKey: "settings.tab.services", icon: ReceiptText },
  { id: "data", labelKey: "settings.tab.data", icon: Database },
  { id: "templates", labelKey: "settings.tab.templates", icon: Layers },
  { id: "wellness", labelKey: "settings.tab.wellness", icon: HeartPulse },
  { id: "messaging", labelKey: "settings.tab.messaging", icon: MessageSquare },
  { id: "booking", labelKey: "settings.tab.booking", icon: Globe },
  { id: "billing", labelKey: "settings.tab.billing", icon: CreditCard },
];

const PRESET_COLORS = [
  "#0d9488",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#16a34a",
  "#f59e0b",
  "#6b7280",
];

// Accent swatches now live in the shared <AccentColorPicker /> (presets +
// custom hex), reused by Settings and the onboarding journey.

const ROLE_BADGE: Record<string, string> = {
  admin:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  veterinarian:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  technician:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  front_desk:
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  viewer:
    "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
};

const ROOM_TYPES = ["exam", "surgery", "treatment", "boarding"] as const;

type PracticeInfoForm = {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  timezone: string;
  country: ClinicRegionCode | "";
  currency: string;
  taxRatePercent: string;
  vatNumber: string;
};

function formatSettingsDateTime(
  value: Date | string | null | undefined,
  timeZone?: string | null,
): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  const resolvedTimeZone = timeZone?.trim() || "UTC";

  try {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: resolvedTimeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }
}

function formatSettingsDateInput(
  value: Date = new Date(),
  timeZone?: string | null,
): string {
  return formatDateInputForTimeZone(value, timeZone?.trim() || "UTC");
}

function requireSettingsExportData<T>(
  result: { data?: T; error?: { message?: string } | null },
  fallbackMessage: string,
): T {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }

  if (result.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return result.data;
}

function SettingsLoadError({
  message,
  title,
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{title ?? t("settings.loadError")}</p>
          <p className="mt-1">{message}</p>
          {onRetry ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-3"
            >
              {t("settings.retry")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const t = useTranslations();
  const { data: session, status } = useSession();
  const { openWelcome } = useWelcome();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "practice";
  const [activeTab, setActiveTab] = useState<Tab>(
    tabs.some((t) => t.id === initialTab) ? initialTab : "practice",
  );

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("settings.loadingAccess")}
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="font-heading text-xl font-semibold">{t("settings.accessDenied")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.accessDeniedDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-semibold">{t("settings.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          data-tour="settings-guides"
          onClick={openWelcome}
        >
          <Compass className="mr-2 h-4 w-4" />
          {t("guides.button")}
        </Button>
      </div>

      <div className="mt-6 flex min-w-0 w-full max-w-full flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Section nav: horizontal scroll on small screens, vertical on lg+ */}
        <nav
          className="min-w-0 max-w-full overflow-hidden lg:w-56 lg:shrink-0"
          aria-label={t("settings.sections")}
        >
          <div className="flex w-full max-w-full gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab content */}
        <div className="min-w-0 w-full max-w-full flex-1">
          {activeTab === "practice" && <PracticeInfoTab />}
          {activeTab === "locations" && <LocationsTab />}
          {activeTab === "staff" && <StaffTab />}
          {activeTab === "appointmentTypes" && <AppointmentTypesTab />}
          {activeTab === "rooms" && <RoomsTab />}
          {activeTab === "services" && <ServicesTab />}
          {activeTab === "data" && <DataTab />}
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "wellness" && <WellnessPlansTab />}
          {activeTab === "messaging" && <MessagingTab />}
          {activeTab === "booking" && <BookingTab />}
          {activeTab === "billing" && <BillingTab />}
        </div>
      </div>
    </div>
  );
}

// ── Practice Info ───────────────────────────────────────────
function PracticeInfoTab() {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const {
    data: practice,
    isLoading,
    error: practiceError,
  } = trpc.settings.getPractice.useQuery();
  const {
    data: marketingEmailPreference,
    isLoading: marketingEmailPreferenceLoading,
    isFetching: marketingEmailPreferenceRefreshing,
    error: marketingEmailPreferenceError,
    refetch: refetchMarketingEmailPreference,
  } = trpc.settings.getMarketingEmailPreference.useQuery();
  const updateMutation = trpc.settings.updatePractice.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.settings.getPractice.invalidate(),
        utils.settings.getMarketingEmailPreference.invalidate(),
      ]);
      toast.success("Practice info updated");
    },
    onError: () => {
      toast.error(t("settings.wellness.createError"));
    },
  });

  // Branding mutation invalidates getBranding too so the sidebar logo/accent
  // refresh without a reload.
  const brandingMutation = trpc.settings.updatePractice.useMutation({
    onSuccess: () => {
      utils.settings.getPractice.invalidate();
      utils.settings.getBranding.invalidate();
      toast.success("Branding updated");
    },
    onError: () => {
      toast.error(t("settings.wellness.updateError"));
    },
  });
  const marketingEmailMutation =
    trpc.settings.setMarketingEmailPreference.useMutation({
      onSuccess: (preference) => {
        utils.settings.getMarketingEmailPreference.invalidate();
        toast.success(
          preference.enabled
            ? `Optional ${platformBrand.productName} emails turned on`
            : `Optional ${platformBrand.productName} emails turned off`,
        );
      },
      onError: (err) => toast.error(err.message),
    });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUploadAttemptRef = useRef<ManagedUploadAttempt | null>(null);

  const handleLogoUpload = async (selectedFile?: File) => {
    if (selectedFile && !isImageUploadFileValid(selectedFile)) {
      logoUploadAttemptRef.current = null;
      setLogoUploadError(null);
      toast.error(IMAGE_UPLOAD_POLICY_MESSAGE);
      return;
    }

    if (selectedFile) {
      logoUploadAttemptRef.current = selectManagedUploadFile(
        logoUploadAttemptRef.current,
        selectedFile,
      );
    }
    const attempt = logoUploadAttemptRef.current;
    if (!attempt) return;

    setUploadingLogo(true);
    setLogoUploadError(null);
    try {
      const body = new FormData();
      body.append("file", attempt.file);
      body.append("category", "branding");
      const res = await fetchWithClientTimeout(
        "/api/upload",
        {
          method: "POST",
          body,
          headers: { "Idempotency-Key": attempt.idempotencyKey },
        },
        CLIENT_UPLOAD_TIMEOUT_MS,
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        logoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
          kind: "response",
          status: res.status,
        });
        throw new Error(json.error ?? "Upload failed");
      }
      logoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
        kind: "success",
      });
      await Promise.all([
        utils.settings.getPractice.invalidate(),
        utils.settings.getBranding.invalidate(),
      ]);
      toast.success("Logo saved");
    } catch (err) {
      if (logoUploadAttemptRef.current === attempt) {
        logoUploadAttemptRef.current = settleManagedUploadAttempt(attempt, {
          kind: "ambiguous",
        });
      }
      const message = err instanceof Error ? err.message : "Upload failed";
      setLogoUploadError(message);
      toast.error(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const [form, setForm] = useState<PracticeInfoForm | null>(null);
  const isOptionalSettingsEmailValid = (email: string) =>
    email.trim().length === 0 ||
    (email.trim().length <= SETTINGS_EMAIL_MAX_LENGTH &&
      isValidEmail(email.trim()));
  const isPracticeInfoFormValid = (practiceForm: PracticeInfoForm) =>
    practiceForm.name.trim().length > 0 &&
    practiceForm.name.trim().length <= PRACTICE_NAME_MAX_LENGTH &&
    practiceForm.address.trim().length <= SETTINGS_ADDRESS_MAX_LENGTH &&
    practiceForm.phone.trim().length <= SETTINGS_PHONE_MAX_LENGTH &&
    isOptionalSettingsEmailValid(practiceForm.email) &&
    practiceForm.website.trim().length <= SETTINGS_WEBSITE_MAX_LENGTH &&
    isSupportedPracticeTimezone(practiceForm.timezone) &&
    isClinicRegionCode(practiceForm.country) &&
    isValidSettingsTaxRate(practiceForm.taxRatePercent) &&
    practiceForm.vatNumber.trim().length <= SETTINGS_VAT_NUMBER_MAX_LENGTH;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (practiceError) {
    return <SettingsLoadError message={practiceError.message} />;
  }
  if (!practice) {
    return (
      <EmptyState
        icon={Settings}
        title="Practice settings unavailable"
        description="The practice profile could not be found for this account."
      />
    );
  }

  const currentBrandColor =
    (practice.settings as { brandColor?: string } | null)?.brandColor ?? null;

  // Initialize form from the verified practice profile. Nullable profile fields
  // still get editable display defaults, but a missing profile never builds a
  // blank form.
  const current: PracticeInfoForm = form ?? {
    name: practice.name ?? "",
    address: practice.address ?? "",
    phone: practice.phone ?? "",
    email: practice.email ?? "",
    website: practice.website ?? "",
    timezone: practice.timezone ?? "America/New_York",
    country:
      practice.jurisdictionConfirmed &&
      practice.country &&
      isClinicRegionCode(practice.country)
        ? practice.country
        : "",
    currency: practice.currency ?? "usd",
    taxRatePercent: practice.taxRatePercent ?? "8.00",
    vatNumber: practice.vatNumber ?? "",
  };

  const handleChange = (field: string, value: string) => {
    setForm({ ...current, [field]: value });
  };

  // Country selection proposes profile defaults. Costa Rica intentionally has
  // no tax default, so the rate must be set explicitly before saving.
  const handleCountryChange = (country: string) => {
    if (!isClinicRegionCode(country)) return;
    const d = regionDefaults(country);
    const profile = regionalProfileDefaultsForCountry(country)!;
    setForm({
      ...current,
      country,
      currency: profile.currencyCode,
      taxRatePercent: d.taxRatePercent ?? "",
      timezone: profile.timezone,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Practice details ── */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("settings.practice.details")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("settings.practice.detailsDescription")}
            </p>
          </div>
          <div className="grid gap-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("settings.practice.name")}</span>
              <Input
                maxLength={PRACTICE_NAME_MAX_LENGTH}
                value={current.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("settings.practice.address")}</span>
              <Input
                maxLength={SETTINGS_ADDRESS_MAX_LENGTH}
                value={current.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("settings.practice.phone")}</span>
                <Input
                  maxLength={SETTINGS_PHONE_MAX_LENGTH}
                  value={current.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("settings.practice.email")}</span>
                <Input
                  type="email"
                  maxLength={SETTINGS_EMAIL_MAX_LENGTH}
                  value={current.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </label>
            </div>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("settings.practice.website")}</span>
              <Input
                maxLength={SETTINGS_WEBSITE_MAX_LENGTH}
                value={current.website}
                onChange={(e) => handleChange("website", e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">{t("settings.practice.timezone")}</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={current.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
              >
                {PRACTICE_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── Region & Tax ── */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("settings.practice.regionTax")}</h3>
            <p className="text-xs text-muted-foreground">
              Controls invoice currency, tax rate, and date formatting. Costa
              Rica requires an explicit tax rate; no local rate is assumed.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("settings.practice.country")}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={current.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  required
                >
                  <option value="">{t("settings.practice.chooseCountry")}</option>
                  {CLINIC_REGION_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("settings.practice.currency")}</span>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={current.currency}
                  onChange={(e) => handleChange("currency", e.target.value)}
                >
                  {PRACTICE_CURRENCY_OPTIONS.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">{t("settings.practice.taxRate")}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={current.taxRatePercent}
                  onChange={(e) =>
                    handleChange("taxRatePercent", e.target.value)
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
                  {t("settings.practice.vatNumber")}
                </span>
                <Input
                  maxLength={SETTINGS_VAT_NUMBER_MAX_LENGTH}
                  value={current.vatNumber}
                  onChange={(e) => handleChange("vatNumber", e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── Branding ── */}
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t("settings.practice.branding")}</h3>
            <p className="text-xs text-muted-foreground">
              Your logo and accent color appear across {platformBrand.productName}. Changes save
              immediately.
            </p>
          </div>
          <div className="grid gap-5">
            {/* Logo */}
            <div className="space-y-2">
              <span className="text-sm font-medium">{t("settings.practice.logo")}</span>
              <div className="flex items-center gap-4">
                {practice.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={practice.logoUrl}
                    alt="Practice logo"
                    className="h-14 w-14 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo || brandingMutation.isPending}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploadingLogo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {practice.logoUrl ? t("settings.practice.replaceLogo") : t("settings.practice.uploadLogo")}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("settings.practice.logoHelp")}
                  </p>
                  {logoUploadError ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                      <span>{logoUploadError}</span>
                      {logoUploadAttemptRef.current ? (
                        <button
                          type="button"
                          disabled={uploadingLogo}
                          onClick={() => void handleLogoUpload()}
                          className="font-medium underline underline-offset-2 disabled:opacity-50"
                        >
                          Try again
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Accent color */}
            <div className="space-y-2">
              <span className="text-sm font-medium">{t("settings.practice.accent")}</span>
              <AccentColorPicker
                value={currentBrandColor}
                onChange={(c) => brandingMutation.mutate({ brandColor: c })}
                disabled={brandingMutation.isPending}
              />
            </div>
          </div>
        </div>

        {/* ── Platform email preferences ── */}
        <div className="space-y-5 rounded-lg border border-border bg-card p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Emails from {platformBrand.productName}</h3>
            <p className="text-xs text-muted-foreground">
              Controls optional email {platformBrand.productName} sends to your clinic, not messages
              your clinic sends to pet owners.
            </p>
          </div>

          {marketingEmailPreferenceError ? (
            <div className="space-y-3" role="alert">
              <p className="text-sm text-destructive">
                We couldn&apos;t load this email preference.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetchMarketingEmailPreference()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  checked={marketingEmailPreference?.enabled ?? true}
                  disabled={
                    marketingEmailPreferenceLoading ||
                    marketingEmailPreferenceRefreshing ||
                    updateMutation.isPending ||
                    marketingEmailMutation.isPending ||
                    marketingEmailPreference?.configurable === false
                  }
                  aria-describedby="marketing-email-preference-description"
                  onChange={(event) =>
                    marketingEmailMutation.mutate({
                      enabled: event.currentTarget.checked,
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    Product guidance and feedback
                  </span>
                  <span
                    id="marketing-email-preference-description"
                    className="mt-1 block text-xs leading-5 text-muted-foreground"
                  >
                    Occasional setup tips, product updates, trial guidance, and
                    requests for feedback. Turn this off to stop marketing and
                    research email
                    {marketingEmailPreference?.recipientEmail
                      ? ` to ${marketingEmailPreference.recipientEmail}`
                      : ""}
                    .
                  </span>
                </span>
                {marketingEmailPreferenceLoading ||
                marketingEmailPreferenceRefreshing ||
                marketingEmailMutation.isPending ? (
                  <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </label>

              {marketingEmailMutation.isError ? (
                <p className="text-xs text-destructive" role="alert">
                  {marketingEmailMutation.error.message}
                </p>
              ) : marketingEmailMutation.isSuccess &&
                marketingEmailMutation.data.recipientEmail ===
                  marketingEmailPreference?.recipientEmail &&
                marketingEmailMutation.data.enabled ===
                  marketingEmailPreference?.enabled ? (
                <p className="text-xs text-emerald-700" role="status">
                  {marketingEmailMutation.data.enabled
                    ? `Optional ${platformBrand.productName} emails are on.`
                    : `Optional ${platformBrand.productName} emails are off.`}
                </p>
              ) : null}

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  Account, security, and billing email
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Required for sign-in, receipts, payment issues, and critical
                  service notices. These cannot be turned off here.
                </p>
              </div>

              {marketingEmailPreference?.configurable === false ? (
                <p className="text-xs text-amber-700" role="status">
                  Add a practice email above, save your changes, then manage
                  optional email here.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={() => {
          if (!isClinicRegionCode(current.country)) return;
          updateMutation.mutate({
            ...current,
            country: current.country,
            email: current.email.trim() || undefined,
          });
        }}
        disabled={!isPracticeInfoFormValid(current) || updateMutation.isPending}
      >
        {updateMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {t("settings.practice.save")}
      </Button>
    </div>
  );
}

// ── Locations ───────────────────────────────────────────────
type LocationForm = {
  name: string;
  address: string;
  phone: string;
  isPrimary: boolean;
};

function LocationsTab() {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const {
    data: locationList,
    isLoading,
    error: locationsError,
    refetch: refetchLocations,
  } = trpc.settings.listLocations.useQuery();

  const invalidateLocationState = () => {
    utils.settings.listLocations.invalidate();
    utils.messaging.getStatus.invalidate();
    utils.messaging.getInboxStatus.invalidate();
    utils.subscription.get.invalidate();
  };

  const createMutation = trpc.settings.createLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      setShowAdd(false);
      setAddForm({ name: "", address: "", phone: "", isPrimary: false });
      toast.success(t("settings.locations.created"));
    },
    onError: () => toast.error(t("settings.locations.loadError")),
  });
  const updateMutation = trpc.settings.updateLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      setEditingId(null);
      toast.success(t("settings.locations.updated"));
    },
    onError: () => toast.error(t("settings.locations.loadError")),
  });
  const setPrimaryMutation = trpc.settings.setPrimaryLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      toast.success(t("settings.locations.primaryUpdated"));
    },
    onError: () => toast.error(t("settings.locations.loadError")),
  });
  const deleteMutation = trpc.settings.deleteLocation.useMutation({
    onSuccess: () => {
      invalidateLocationState();
      setConfirmDelete(null);
      toast.success(t("settings.locations.retired"));
    },
    onError: () => toast.error(t("settings.locations.loadError")),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<LocationForm>({
    name: "",
    address: "",
    phone: "",
    isPrimary: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LocationForm>({
    name: "",
    address: "",
    phone: "",
    isPrimary: false,
  });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const locationsMissing = !isLoading && !locationsError && !locationList;
  const activeLocationCount = locationList?.length ?? 0;
  const isLocationFormValid = (form: {
    name: string;
    address: string;
    phone: string;
  }) =>
    form.name.trim().length > 0 &&
    form.name.trim().length <= LOCATION_NAME_MAX_LENGTH &&
    form.phone.trim().length <= SETTINGS_PHONE_MAX_LENGTH &&
    form.address.trim().length <= SETTINGS_ADDRESS_MAX_LENGTH;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (locationsError) {
    return <SettingsLoadError message={locationsError.message} />;
  }
  if (locationsMissing) {
    return (
      <SettingsLoadError
        title={t("settings.locations.loadError")}
        message={t("settings.locations.loadDescription")}
        onRetry={() => void refetchLocations()}
      />
    );
  }

  const startEditing = (location: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    isPrimary: boolean;
  }) => {
    setEditingId(location.id);
    setEditForm({
      name: location.name,
      address: location.address ?? "",
      phone: location.phone ?? "",
      isPrimary: location.isPrimary,
    });
    setConfirmDelete(null);
  };

  const saveLocation = (id: string) => {
    updateMutation.mutate({
      id,
      name: editForm.name,
      address: editForm.address,
      phone: editForm.phone,
    });
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t("settings.locations.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings.locations.description")}
          </p>
        </div>
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            setEditingId(null);
            setConfirmDelete(null);
          }}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("settings.locations.add")}
        </Button>
      </div>

      {showAdd ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("settings.locations.new")}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t("settings.locations.name")}
              maxLength={LOCATION_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              placeholder={t("settings.practice.phone")}
              maxLength={SETTINGS_PHONE_MAX_LENGTH}
              value={addForm.phone}
              onChange={(e) =>
                setAddForm({ ...addForm, phone: e.target.value })
              }
            />
            <Input
              placeholder={t("settings.practice.address")}
              maxLength={SETTINGS_ADDRESS_MAX_LENGTH}
              value={addForm.address}
              onChange={(e) =>
                setAddForm({ ...addForm, address: e.target.value })
              }
              className="sm:col-span-2"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={addForm.isPrimary}
              onChange={(e) =>
                setAddForm({ ...addForm, isPrimary: e.target.checked })
              }
            />
            {t("settings.locations.makePrimary")}
          </label>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              disabled={
                !isLocationFormValid(addForm) || createMutation.isPending
              }
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("settings.locations.create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("settings.locations.cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("settings.locations.title")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.locations.contact")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("billing.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {locationList?.map((location) => {
              const isEditing = editingId === location.id;
              const isConfirmingDelete = confirmDelete === location.id;

              return (
                <tr
                  key={location.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 align-top">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          maxLength={LOCATION_NAME_MAX_LENGTH}
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                        />
                        <Input
                          value={editForm.address}
                          placeholder={t("settings.practice.address")}
                          maxLength={SETTINGS_ADDRESS_MAX_LENGTH}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              address: e.target.value,
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{location.name}</span>
                          {location.isPrimary ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <Star className="h-3 w-3" />
                              {t("settings.locations.primary")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {location.address || t("settings.locations.noAddress")}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        placeholder={t("settings.practice.phone")}
                        maxLength={SETTINGS_PHONE_MAX_LENGTH}
                        onChange={(e) =>
                          setEditForm({ ...editForm, phone: e.target.value })
                        }
                      />
                    ) : (
                      location.phone || t("settings.locations.noPhone")
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={
                              !isLocationFormValid(editForm) ||
                              updateMutation.isPending
                            }
                            onClick={() => saveLocation(location.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {!location.isPrimary ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={setPrimaryMutation.isPending}
                              onClick={() =>
                                setPrimaryMutation.mutate({ id: location.id })
                              }
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(location)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isConfirmingDelete ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={
                                deleteMutation.isPending ||
                                activeLocationCount <= 1
                              }
                              onClick={() =>
                                deleteMutation.mutate({ id: location.id })
                              }
                            >
                              <Check className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={activeLocationCount <= 1}
                              onClick={() => setConfirmDelete(location.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {locationList?.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={MapPin}
                    title={t("settings.locations.empty")}
                    description={t("settings.locations.emptyDescription")}
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {activeLocationCount <= 1 ? (
        <p className="text-xs text-muted-foreground">
          {t("settings.locations.minimum")}
        </p>
      ) : null}
    </div>
  );
}

// ── Plan & Billing ──────────────────────────────────────────
function redirectToHostedBillingUrl(url: unknown, unavailableMessage: string) {
  if (!isSafeCheckoutRedirectUrl(url)) {
    toast.error(unavailableMessage);
    return;
  }

  window.location.href = url;
}

function redirectToClientPaymentUrl(url: unknown, unavailableMessage: string) {
  if (!isSafeCheckoutRedirectUrl(url)) {
    toast.error(unavailableMessage);
    return;
  }

  window.location.href = url;
}

function billingStatusLabel(t: Translator, status: string) {
  switch (status) {
    case "active": return t("settings.billing.status.active");
    case "past_due": return t("settings.billing.status.pastDue");
    case "unpaid": return t("settings.billing.status.unpaid");
    case "canceled": return t("settings.billing.status.canceled");
    case "none": return t("settings.billing.status.none");
    default: return status.replace("_", " ");
  }
}

function billingFeatureLabel(t: Translator, feature: string) {
  switch (feature) {
    case "agent": return t("settings.billing.feature.agent");
    case "sms": return t("settings.billing.feature.sms");
    case "advancedReporting": return t("settings.billing.feature.advancedReporting");
    case "apiAccess": return t("settings.billing.feature.apiAccess");
    case "multiLocation": return t("settings.billing.feature.multiLocation");
    case "integrations": return t("settings.billing.feature.integrations");
    default: return feature;
  }
}

function BillingTab() {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const [selectedCadence, setSelectedCadence] = useState<BillingCadence>(() =>
    billingCadenceFromQuery(searchParams.get("plan")),
  );
  const {
    data,
    isLoading,
    error: billingError,
    refetch: refetchBilling,
  } = trpc.subscription.get.useQuery();
  const paymentAccount = trpc.billing.paymentAccountStatus.useQuery(undefined, {
    staleTime: 60_000,
  });
  const checkout = trpc.subscription.createCheckout.useMutation({
    onSuccess: (r) => {
      redirectToHostedBillingUrl(r.url, t("settings.billing.checkoutUnavailable"));
    },
    onError: () => toast.error(t("settings.billing.checkoutUnavailable")),
  });
  const setupPaymentAccount =
    trpc.billing.createPaymentAccountOnboarding.useMutation({
      onSuccess: (r) => {
      redirectToClientPaymentUrl(r.url, t("settings.billing.paymentSetupUnavailable"));
      },
      onError: () => toast.error(t("settings.billing.paymentSetupUnavailable")),
    });
  const refreshPaymentAccount = trpc.billing.refreshPaymentAccount.useMutation({
    onSuccess: () => {
      utils.billing.paymentAccountStatus.invalidate();
      toast.success(t("settings.billing.paymentStatusRefreshed"));
    },
    onError: () => toast.error(t("settings.billing.paymentStatusError")),
  });
  const openPaymentAccountDashboard =
    trpc.billing.openPaymentAccountDashboard.useMutation({
      onSuccess: (r) => {
      redirectToClientPaymentUrl(r.url, t("settings.billing.paymentSetupUnavailable"));
      },
      onError: () => toast.error(t("settings.billing.paymentSetupUnavailable")),
    });
  const portal = trpc.subscription.openBillingPortal.useMutation({
    onSuccess: (r) => {
      redirectToHostedBillingUrl(r.url, t("settings.billing.checkoutUnavailable"));
    },
    onError: () => toast.error(t("settings.billing.checkoutUnavailable")),
  });

  if (billingError) {
    return (
      <SettingsLoadError
        title={t("settings.billing.loadError")}
        message={t("settings.billing.loadFailure")}
        onRetry={() => void refetchBilling()}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <SettingsLoadError
        title={t("settings.billing.loadError")}
        message={t("settings.billing.loadDescription")}
        onRetry={() => void refetchBilling()}
      />
    );
  }

  // Self-host: nothing to buy — everything is unlocked.
  if (!data.billingEnforced) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-600" />
              <h3 className="font-heading text-lg font-semibold">
                {t("settings.billing.selfHostedTitle")}
              </h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("settings.billing.selfHostedDescription")}
            </p>
          </div>
          <ClientPaymentProcessingSection
            data={paymentAccount.data}
            isLoading={paymentAccount.isLoading}
            error={paymentAccount.error?.message}
            setupPending={setupPaymentAccount.isPending}
            refreshPending={refreshPaymentAccount.isPending}
            dashboardPending={openPaymentAccountDashboard.isPending}
            onSetup={() => setupPaymentAccount.mutate()}
            onRefresh={() => refreshPaymentAccount.mutate()}
            onDashboard={() => openPaymentAccountDashboard.mutate()}
          />
        </div>
        <PlanGrid
          plans={data.plans}
          currentTier={data.tier}
          enforced={false}
          onChoose={() => {}}
          busyTier={null}
        />
      </div>
    );
  }

  const daysLeft = trialCalendarDaysLeft(data.trialEndsAt, data.timezone) ?? 0;
  const currentPlan = data.plans.find((p) => p.tier === data.tier);
  const showReadOnlyNotice = !data.hasFullAccess;
  const availableCadences = data.billingOptions
    .filter((option) => option.purchasable)
    .map((option) => option.cadence);
  const firstActivation = !data.hasSubscription;
  const checkoutStatus = searchParams.get("checkout");
  // Only surface the sync note when something actually needs attention.
  const showSyncNote =
    data.billingSyncStatus &&
    (data.billingSyncStatus.status === "error" ||
      data.billingSyncStatus.status === "legacy");

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      {checkoutStatus === "cancelled" ? (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
          <p className="font-medium">{t("settings.billing.checkoutCancelled")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("settings.billing.checkoutCancelledDescription")}
          </p>
        </div>
      ) : null}
      {checkoutStatus === "success" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">{t("settings.billing.checkoutReceived")}</p>
          <p className="mt-1">{t("settings.billing.checkoutReceivedDescription")}</p>
        </div>
      ) : null}

      <div className="min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm">
        <div className="border-b border-primary/10 bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-primary">
                  {platformBrand.productName}
                </p>
                <Badge
                  variant={data.billingStatus === "active" ? "success" : "info"}
                >
                  {data.billingStatus === "trialing"
                    ? `${daysLeft} ${t(daysLeft === 1 ? "settings.billing.trialDayLeft" : "settings.billing.trialDaysLeft")}`
                    : billingStatusLabel(t, data.billingStatus)}
                </Badge>
              </div>
              <h3 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
                {firstActivation
                  ? t("settings.billing.activateAccount")
                  : t("settings.billing.cloudSubscription")}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {firstActivation
                  ? t("settings.billing.activateDescription")
                  : `${currentPlan?.name ?? "Cloud"} ${t("settings.billing.cloudDescription")}`}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {showReadOnlyNotice ? (
            <div className="mb-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t("settings.billing.readOnly")}
              </p>
            </div>
          ) : null}

          {data.billingStatus === "past_due" ? (
            <div className="mb-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {t("settings.billing.pastDue")}
              </p>
            </div>
          ) : null}

          {firstActivation ? (
            <>
              <CloudBillingCadencePicker
                value={selectedCadence}
                onValueChange={setSelectedCadence}
                locationCount={data.locationCount}
                availableCadences={availableCadences}
                disabled={checkout.isPending}
              />

              <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {selectedCadence === "year"
                      ? `$${data.estimatedAnnualBase} ${t("settings.billing.yearlyBilled")}`
                      : `$${data.estimatedMonthlyBase} ${t("settings.billing.monthlyBilled")}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.billingStatus === "trialing"
                      ? `${t("settings.billing.noChargeToday")} ${daysLeft} ${t(daysLeft === 1 ? "settings.billing.trialDayLeft" : "settings.billing.trialDaysLeft")} ${t("settings.billing.remaining")}`
                      : t("settings.billing.paymentMethodStored")}
                  </p>
                </div>
                <Button
                  className="w-full gap-2 sm:w-auto"
                  disabled={
                    checkout.isPending ||
                    !availableCadences.includes(selectedCadence)
                  }
                  onClick={() =>
                    checkout.mutate({
                      tier: "cloud",
                      billingCadence: selectedCadence,
                    })
                  }
                >
                  {checkout.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  {t("settings.billing.secureCheckout")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {data.currentBillingCadence === "year"
                    ? `$${data.estimatedAnnualBase} ${t("settings.billing.perYear")}`
                    : `$${data.estimatedMonthlyBase} ${t("settings.billing.perMonth")}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.billing.manageDescription")}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={portal.isPending}
                onClick={() => portal.mutate()}
              >
                {portal.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {t("settings.billing.manage")}
              </Button>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {[
              t("settings.billing.poweredByStripe"),
              t("settings.billing.cancelAnytime"),
              t("settings.billing.unlimitedStaff"),
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>

          {(currentPlan?.includedSmsPerMonth != null ||
            currentPlan?.includedAiRunsPerMonth != null) && (
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              {t("settings.billing.thisMonth")} {data.usage.sms} of{" "}
              {currentPlan?.includedSmsPerMonth?.toLocaleString()} {t("settings.billing.includedTexts")} · {data.usage.aiRuns} of{" "}
              {currentPlan?.includedAiRunsPerMonth?.toLocaleString()} {t("settings.billing.includedAiActions")}
            </p>
          )}

          {showSyncNote ? (
            <div
              className={cn(
                "mt-4 rounded-md border p-3 text-xs",
                data.billingSyncStatus!.status === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              )}
            >
              <span className="font-medium">{t("settings.billing.sync")} </span>
              {data.billingSyncStatus!.message}
            </div>
          ) : null}
        </div>
      </div>

      <ClientPaymentProcessingSection
        data={paymentAccount.data}
        isLoading={paymentAccount.isLoading}
        error={paymentAccount.error?.message}
        setupPending={setupPaymentAccount.isPending}
        refreshPending={refreshPaymentAccount.isPending}
        dashboardPending={openPaymentAccountDashboard.isPending}
        onSetup={() => setupPaymentAccount.mutate()}
        onRefresh={() => refreshPaymentAccount.mutate()}
        onDashboard={() => openPaymentAccountDashboard.mutate()}
      />
    </div>
  );
}

function ClientPaymentProcessingSection({
  data,
  isLoading,
  error,
  setupPending,
  refreshPending,
  dashboardPending,
  onSetup,
  onRefresh,
  onDashboard,
}: {
  data:
    | {
        stripeConfigured: boolean;
        connectRequired: boolean;
        status:
          | "not_started"
          | "pending"
          | "active"
          | "action_required"
          | "disabled"
          | "not_configured"
          | "not_required";
        enabled: boolean;
        chargesEnabled?: boolean;
        payoutsEnabled?: boolean;
        detailsSubmitted?: boolean;
        requirementsCurrentlyDue?: string[];
        requirementsDisabledReason?: string | null;
        lastSyncedAt?: Date | string | null;
      }
    | undefined;
  isLoading: boolean;
  error?: string;
  setupPending: boolean;
  refreshPending: boolean;
  dashboardPending: boolean;
  onSetup: () => void;
  onRefresh: () => void;
  onDashboard: () => void;
}) {
  const t = useTranslations();
  const status = data?.enabled
    ? t("settings.billing.paymentStatus.ready")
    : data?.status === "action_required" || data?.status === "disabled"
      ? t("settings.billing.paymentStatus.actionRequired")
      : data?.connectRequired
        ? t("settings.billing.paymentStatus.setupNeeded")
        : data?.stripeConfigured
          ? t("settings.billing.paymentStatus.configured")
          : t("settings.billing.paymentStatus.notConfigured");
  const statusClass = data?.enabled
    ? "bg-green-100 text-green-700"
    : data?.status === "action_required" || data?.status === "disabled"
      ? "bg-amber-100 text-amber-800"
      : data?.stripeConfigured
        ? "bg-blue-100 text-blue-700"
        : "bg-gray-100 text-gray-600";
  const canOpenDashboard = Boolean(
    data?.connectRequired && data.status !== "not_started",
  );
  const canShowSetup =
    Boolean(data?.connectRequired && data.stripeConfigured) &&
    data?.status !== "active";

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-semibold">
              {t("settings.billing.paymentProcessing")}
            </h3>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize",
                statusClass,
              )}
            >
              {status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {data?.connectRequired
              ? t("settings.billing.connectDescription")
              : t("settings.billing.directPaymentDescription")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canShowSetup && (
            <Button size="sm" disabled={setupPending} onClick={onSetup}>
              {setupPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {data?.status === "not_started"
                ? t("settings.billing.setUp")
                : t("settings.billing.resumeSetup")}
            </Button>
          )}
          {data?.connectRequired && (
            <Button
              size="sm"
              variant="outline"
              disabled={refreshPending || !data.stripeConfigured}
              onClick={onRefresh}
            >
              {refreshPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {t("settings.billing.refresh")}
            </Button>
          )}
          {canOpenDashboard && (
            <Button
              size="sm"
              variant="outline"
              disabled={dashboardPending}
              onClick={onDashboard}
            >
              {dashboardPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {t("settings.billing.openStripe")}
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("settings.billing.loadingPaymentStatus")}
        </div>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{t("settings.billing.paymentStatusError")}</p>}
      {!isLoading && !error && data && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("settings.billing.stripeApi")}</p>
            <p className="font-medium">
              {data.stripeConfigured
                ? t("settings.billing.paymentStatus.configured")
                : t("settings.billing.missing")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("settings.billing.cardPayments")}</p>
            <p className="font-medium">
              {data.enabled || data.status === "not_required"
                ? t("settings.billing.enabled")
                : t("settings.billing.disabled")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("settings.billing.payouts")}</p>
            <p className="font-medium">
              {data.payoutsEnabled
                ? t("settings.billing.enabled")
                : data.connectRequired
                  ? t("settings.billing.pending")
                  : t("settings.billing.notApplicable")}
            </p>
          </div>
          {data.requirementsCurrentlyDue?.length ? (
            <div className="sm:col-span-3">
              <p className="text-muted-foreground">{t("settings.billing.requirements")}</p>
              <p className="font-medium">
                {data.requirementsCurrentlyDue.length}{" "}
                {t(data.requirementsCurrentlyDue.length === 1
                  ? "settings.billing.itemDue"
                  : "settings.billing.itemsDue")}
              </p>
            </div>
          ) : null}
          {data.requirementsDisabledReason ? (
            <div className="sm:col-span-3">
              <p className="text-muted-foreground">{t("settings.billing.disabledReason")}</p>
              <p className="font-medium">{data.requirementsDisabledReason}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PlanGrid({
  plans,
  currentTier,
  enforced,
  onChoose,
  busyTier,
}: {
  plans: Array<{
    tier: string;
    name: string;
    locationUnitPriceMonthlyUsd: number | null;
    seatUnitPriceMonthlyUsd: number | null;
    blurb: string;
    features: string[];
    seatLimit: number | null;
    locationLimit: number | null;
    includedSmsPerMonth: number | null;
    includedAiRunsPerMonth: number | null;
    aiOveragePriceUsd: number | null;
    smsOveragePriceUsd: number | null;
    selfServe: boolean;
    purchasable: boolean;
  }>;
  currentTier: string;
  enforced: boolean;
  onChoose: (tier: "cloud") => void;
  busyTier: string | null;
}) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {plans.map((p) => {
        const isCurrent = p.tier === currentTier;
        const canBuy =
          enforced && p.purchasable && p.tier === "cloud" && !isCurrent;
        return (
          <div
            key={p.tier}
            className={cn(
              "flex flex-col rounded-lg border bg-card p-5",
              isCurrent
                ? "border-primary ring-1 ring-primary"
                : "border-border",
            )}
          >
            <h4 className="font-heading text-base font-semibold">{p.name}</h4>
            <p className="mt-1 text-2xl font-bold">
              {p.locationUnitPriceMonthlyUsd === null ? (
                t("settings.billing.custom")
              ) : p.locationUnitPriceMonthlyUsd === 0 ? (
                t("settings.billing.free")
              ) : (
                <>
                  ${p.locationUnitPriceMonthlyUsd}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("settings.billing.perLocation")}
                  </span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {p.seatUnitPriceMonthlyUsd && p.seatUnitPriceMonthlyUsd > 0
                      ? `+ $${p.seatUnitPriceMonthlyUsd}${t("settings.billing.perStaffMonth")}`
                      : t("settings.billing.unlimitedStaff")}
                  </span>
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{p.blurb}</p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>
                {p.seatLimit === null ? t("settings.billing.all") : p.seatLimit}{" "}
                {t("settings.billing.staffRolesIncluded")}
              </li>
              <li>
                {p.locationLimit === null ? t("settings.billing.unlimited") : p.locationLimit}{" "}
                {p.locationLimit === 1
                  ? t("settings.billing.location")
                  : t("settings.billing.locations")}
              </li>
              {p.includedSmsPerMonth ? (
                <li>
                  {p.includedSmsPerMonth.toLocaleString()} {t("settings.billing.smsIncluded")}
                  {p.smsOveragePriceUsd
                    ? `, ${t("settings.billing.then")} $${p.smsOveragePriceUsd}${t("settings.billing.perSms")}`
                    : ""}
                </li>
              ) : null}
              {p.includedAiRunsPerMonth ? (
                <li>
                  {p.includedAiRunsPerMonth.toLocaleString()} {t("settings.billing.aiActionsIncluded")}
                  {p.aiOveragePriceUsd
                    ? `, ${t("settings.billing.then")} $${p.aiOveragePriceUsd}${t("settings.billing.perAction")}`
                    : ""}
                </li>
              ) : null}
              {p.features.length > 0 ? (
                p.features.map((f) => (
                  <li key={f} className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-600" />
                    {billingFeatureLabel(t, f)}
                  </li>
                ))
              ) : (
                <li>{t("settings.billing.fullPims")}</li>
              )}
            </ul>
            <div className="mt-4 pt-2">
              {isCurrent ? (
                <span className="text-xs font-medium text-primary">
                  {t("settings.billing.currentPlan")}
                </span>
              ) : canBuy ? (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={busyTier === p.tier}
                  onClick={() => onChoose(p.tier as "cloud")}
                >
                  {busyTier === p.tier ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("settings.billing.choose")} {p.name}
                </Button>
              ) : !p.selfServe ? (
                <a
                  href={
                    platformOperationalConfig.supportEmail
                      ? `mailto:${platformOperationalConfig.supportEmail}?subject=${encodeURIComponent(`${platformBrand.productName} Enterprise`)}`
                      : undefined
                  }
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {platformOperationalConfig.supportEmail
                    ? t("settings.billing.contactSales")
                    : t("settings.billing.salesContactPending")}
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Staff ───────────────────────────────────────────────────
function StaffTab() {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const {
    data: staffList,
    isLoading,
    error: staffError,
    refetch: refetchStaff,
  } = trpc.settings.listUsers.useQuery();
  const createMutation = trpc.settings.createUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success(t("settings.staff.created"));
    },
    onError: () => toast.error(t("settings.staff.loadError")),
  });
  const updateMutation = trpc.settings.updateUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      setEditingId(null);
      toast.success(t("settings.staff.updated"));
    },
    onError: () => toast.error(t("settings.staff.loadError")),
  });
  const deactivateMutation = trpc.settings.deactivateUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      toast.success(t("settings.staff.deactivated"));
    },
    onError: () => toast.error(t("settings.staff.loadError")),
  });
  const inviteMutation = trpc.settings.inviteStaff.useMutation({
    onSuccess: (res) => {
      utils.settings.listUsers.invalidate();
      setInviteForm({ email: "", name: "", role: "front_desk" });
      setInviteUrl(res.inviteUrl ?? null);
      toast.success(t("settings.staff.inviteSent"));
    },
    onError: () => toast.error(t("settings.staff.loadError")),
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "front_desk" as
      | "admin"
      | "veterinarian"
      | "technician"
      | "front_desk"
      | "viewer",
  });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "front_desk" as
      | "admin"
      | "veterinarian"
      | "technician"
      | "front_desk"
      | "viewer",
    isVeterinarian: false,
    phone: "",
    licenseNumber: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "front_desk" as
      | "admin"
      | "veterinarian"
      | "technician"
      | "front_desk"
      | "viewer",
    isVeterinarian: false,
    phone: "",
    licenseNumber: "",
  });
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(
    null,
  );

  const resetAddForm = () =>
    setAddForm({
      name: "",
      email: "",
      password: "",
      role: "front_desk",
      isVeterinarian: false,
      phone: "",
      licenseNumber: "",
    });
  const isStaffNameValid = (name: string) =>
    name.trim().length > 0 && name.trim().length <= STAFF_NAME_MAX_LENGTH;
  const isOptionalStaffNameValid = (name: string) =>
    name.trim().length <= STAFF_NAME_MAX_LENGTH;
  const isSettingsEmailInputValid = (email: string) =>
    email.trim().length <= SETTINGS_EMAIL_MAX_LENGTH &&
    isValidEmail(email.trim());
  const isStaffContactFieldsValid = (form: {
    phone: string;
    licenseNumber: string;
  }) =>
    form.phone.trim().length <= SETTINGS_PHONE_MAX_LENGTH &&
    form.licenseNumber.trim().length <= STAFF_LICENSE_NUMBER_MAX_LENGTH;
  const isStaffPasswordValid = (password: string) =>
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    password.length <= AUTH_PASSWORD_MAX_LENGTH;
  const isStaffCreateFormValid = (form: typeof addForm) =>
    isStaffNameValid(form.name) &&
    isSettingsEmailInputValid(form.email) &&
    isStaffPasswordValid(form.password) &&
    isStaffContactFieldsValid(form);
  const isStaffInviteFormValid = (form: typeof inviteForm) =>
    isSettingsEmailInputValid(form.email) &&
    isOptionalStaffNameValid(form.name);
  const isStaffEditFormValid = (form: typeof editForm) =>
    isStaffNameValid(form.name) && isStaffContactFieldsValid(form);
  const staffMissing = !isLoading && !staffError && !staffList;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (staffError) {
    return <SettingsLoadError message={staffError.message} />;
  }
  if (staffMissing) {
    return (
      <SettingsLoadError
        title={t("settings.staff.loadError")}
        message={t("settings.staff.loadDescription")}
        onRetry={() => void refetchStaff()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => {
            setShowInvite(!showInvite);
            setShowAdd(false);
            setInviteUrl(null);
          }}
          size="sm"
          variant="outline"
        >
          <Mail className="mr-2 h-4 w-4" />
          {t("settings.staff.invite")}
        </Button>
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            setShowInvite(false);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("settings.staff.add")}
        </Button>
      </div>

      {showInvite && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.staff.inviteTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.staff.inviteDescription")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("settings.practice.email")}
              type="email"
              maxLength={SETTINGS_EMAIL_MAX_LENGTH}
              value={inviteForm.email}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, email: e.target.value })
              }
            />
            <Input
              placeholder={`${t("settings.staff.name")} (${t("booking.public.optional")})`}
              maxLength={STAFF_NAME_MAX_LENGTH}
              value={inviteForm.name}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, name: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({
                  ...inviteForm,
                  role: e.target.value as typeof inviteForm.role,
                })
              }
            >
              <option value="front_desk">{t("settings.staff.frontDesk")}</option>
              <option value="viewer">{t("settings.staff.viewer")}</option>
              <option value="technician">{t("settings.staff.technician")}</option>
              <option value="veterinarian">{t("settings.staff.veterinarian")}</option>
              <option value="admin">{t("settings.staff.admin")}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isStaffInviteFormValid(inviteForm) || inviteMutation.isPending
              }
              onClick={() =>
                inviteMutation.mutate({
                  email: inviteForm.email,
                  name: inviteForm.name || undefined,
                  role: inviteForm.role,
                })
              }
            >
              {inviteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("settings.staff.send")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInvite(false)}
            >
              {t("settings.staff.cancel")}
            </Button>
          </div>
          {inviteUrl && (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Invite link (shown in dev/preview so you can test the flow):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                  {inviteUrl}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    toast.success(t("settings.staff.copied"));
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {inviteMutation.error && (
            <p className="text-sm text-destructive">
              {inviteMutation.error.message}
            </p>
          )}
        </div>
      )}

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.staff.new")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("settings.staff.name")}
              maxLength={STAFF_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              placeholder={t("settings.practice.email")}
              type="email"
              maxLength={SETTINGS_EMAIL_MAX_LENGTH}
              value={addForm.email}
              onChange={(e) =>
                setAddForm({ ...addForm, email: e.target.value })
              }
            />
            <Input
              placeholder={t("settings.staff.passwordHint").replace("{min}", String(AUTH_PASSWORD_MIN_LENGTH))}
              type="password"
              maxLength={AUTH_PASSWORD_MAX_LENGTH}
              value={addForm.password}
              onChange={(e) =>
                setAddForm({ ...addForm, password: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.role}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  role: e.target.value as typeof addForm.role,
                  isVeterinarian:
                    e.target.value === "veterinarian" || addForm.isVeterinarian,
                })
              }
            >
              <option value="front_desk">{t("settings.staff.frontDesk")}</option>
              <option value="viewer">{t("settings.staff.viewer")}</option>
              <option value="technician">{t("settings.staff.technician")}</option>
              <option value="veterinarian">{t("settings.staff.veterinarian")}</option>
              <option value="admin">{t("settings.staff.admin")}</option>
            </select>
            <Input
              placeholder={t("settings.staff.phone")}
              maxLength={SETTINGS_PHONE_MAX_LENGTH}
              value={addForm.phone}
              onChange={(e) =>
                setAddForm({ ...addForm, phone: e.target.value })
              }
            />
            <Input
              placeholder={t("settings.staff.license")}
              maxLength={STAFF_LICENSE_NUMBER_MAX_LENGTH}
              value={addForm.licenseNumber}
              onChange={(e) =>
                setAddForm({ ...addForm, licenseNumber: e.target.value })
              }
            />
            <label className="col-span-2 flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={addForm.isVeterinarian}
                disabled={addForm.role === "veterinarian"}
                onChange={(event) =>
                  setAddForm({
                    ...addForm,
                    isVeterinarian: event.target.checked,
                  })
                }
              />
              <span>
                {t("settings.staff.providerDescription")}
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isStaffCreateFormValid(addForm) || createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  ...addForm,
                  phone: addForm.phone || undefined,
                  licenseNumber: addForm.licenseNumber || undefined,
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("settings.staff.create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("settings.staff.cancel")}
            </Button>
          </div>
          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("settings.staff.name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.practice.email")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.staff.role")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.staff.provider")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.practice.phone")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.staff.license")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("settings.staff.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {staffList?.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border last:border-0"
              >
                {editingId === user.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={STAFF_NAME_MAX_LENGTH}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            role: e.target.value as typeof editForm.role,
                            isVeterinarian:
                              e.target.value === "veterinarian" ||
                              editForm.isVeterinarian,
                          })
                        }
                      >
                        <option value="front_desk">{t("settings.staff.frontDesk")}</option>
                        <option value="viewer">{t("settings.staff.viewer")}</option>
                        <option value="technician">{t("settings.staff.technician")}</option>
                        <option value="veterinarian">{t("settings.staff.veterinarian")}</option>
                        <option value="admin">{t("settings.staff.admin")}</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={editForm.isVeterinarian}
                          disabled={editForm.role === "veterinarian"}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
                              isVeterinarian: event.target.checked,
                            })
                          }
                        />
                        {t("settings.staff.veterinarian")}
                      </label>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={SETTINGS_PHONE_MAX_LENGTH}
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm({ ...editForm, phone: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={STAFF_LICENSE_NUMBER_MAX_LENGTH}
                        value={editForm.licenseNumber}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            licenseNumber: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={
                            !isStaffEditFormValid(editForm) ||
                            updateMutation.isPending
                          }
                          onClick={() =>
                            updateMutation.mutate({
                              id: user.id,
                              name: editForm.name,
                              role: editForm.role,
                              isVeterinarian: editForm.isVeterinarian,
                              phone: editForm.phone || undefined,
                              licenseNumber:
                                editForm.licenseNumber || undefined,
                            })
                          }
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          ROLE_BADGE[user.role] ?? ROLE_BADGE.front_desk,
                        )}
                      >
                        {t(`settings.staff.${user.role === "front_desk" ? "frontDesk" : user.role}` as keyof typeof import("@/lib/i18n/messages").enMessages)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.isVeterinarian ? t("settings.staff.veterinarian") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.phone ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.licenseNumber ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDeactivate === user.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="mr-2 text-xs text-destructive">
                            Deactivate?
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deactivateMutation.isPending}
                            onClick={() => {
                              deactivateMutation.mutate({ id: user.id });
                              setConfirmDeactivate(null);
                            }}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeactivate(null)}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(user.id);
                              setEditForm({
                                name: user.name,
                                role: user.role,
                                isVeterinarian: user.isVeterinarian,
                                phone: user.phone ?? "",
                                licenseNumber: user.licenseNumber ?? "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeactivate(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {staffList?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={Users}
                    title={t("settings.staff.empty")}
                    description={t("settings.staff.emptyDescription")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ProviderHours />
    </div>
  );
}

// ── Appointment Types ───────────────────────────────────────
function AppointmentTypesTab() {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const {
    data: types,
    isLoading,
    error: appointmentTypesError,
    refetch: refetchAppointmentTypes,
  } = trpc.settings.listAppointmentTypes.useQuery();
  const createMutation = trpc.settings.createAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success("Appointment type created");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.settings.updateAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      setEditingId(null);
      toast.success("Appointment type updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deleteMutation = trpc.settings.deleteAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      toast.success("Appointment type deleted");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    durationMinutes: 30,
    color: "#0d9488",
    requiresDoctor: 1,
    defaultRoomType: "exam" as "exam" | "surgery" | "treatment" | "boarding",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...addForm });
  const isDurationValid = (duration: number) =>
    Number.isInteger(duration) &&
    duration >= APPOINTMENT_TYPE_DURATION_MIN_MINUTES &&
    duration <= APPOINTMENT_TYPE_DURATION_MAX_MINUTES;
  const isAppointmentTypeNameValid = (name: string) =>
    name.trim().length > 0 &&
    name.trim().length <= APPOINTMENT_TYPE_NAME_MAX_LENGTH;

  const resetAddForm = () =>
    setAddForm({
      name: "",
      durationMinutes: 30,
      color: "#0d9488",
      requiresDoctor: 1,
      defaultRoomType: "exam",
    });
  const appointmentTypesMissing =
    !isLoading && !appointmentTypesError && !types;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (appointmentTypesError) {
    return <SettingsLoadError message={appointmentTypesError.message} />;
  }
  if (appointmentTypesMissing) {
    return (
      <SettingsLoadError
        title="Could not load appointment types"
        message="The appointment type request finished without returning data. Try loading it again before editing scheduling defaults."
        onRetry={() => void refetchAppointmentTypes()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("settings.types.add")}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.types.new")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("settings.types.name")}
              maxLength={APPOINTMENT_TYPE_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              type="number"
              placeholder={t("settings.types.durationPlaceholder")}
              min={APPOINTMENT_TYPE_DURATION_MIN_MINUTES}
              max={APPOINTMENT_TYPE_DURATION_MAX_MINUTES}
              value={addForm.durationMinutes}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  durationMinutes: parseInt(e.target.value) || 30,
                })
              }
            />
            <div className="space-y-1.5">
              <span className="text-sm font-medium">{t("settings.types.color")}</span>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      addForm.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setAddForm({ ...addForm, color: c })}
                  />
                ))}
              </div>
            </div>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.defaultRoomType}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  defaultRoomType: e.target
                    .value as typeof addForm.defaultRoomType,
                })
              }
            >
              {ROOM_TYPES.map((roomType) => (
                <option key={roomType} value={roomType}>
                  {t(`settings.types.room.${roomType}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isAppointmentTypeNameValid(addForm.name) ||
                !isDurationValid(addForm.durationMinutes) ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("settings.types.create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("settings.types.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("settings.types.name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.types.duration")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.types.color")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.types.roomType")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("settings.staff.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {types?.map((type) => (
              <tr
                key={type.id}
                className="border-b border-border last:border-0"
              >
                {editingId === type.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        maxLength={APPOINTMENT_TYPE_NAME_MAX_LENGTH}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8 w-20"
                        type="number"
                        min={APPOINTMENT_TYPE_DURATION_MIN_MINUTES}
                        max={APPOINTMENT_TYPE_DURATION_MAX_MINUTES}
                        value={editForm.durationMinutes}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            durationMinutes: parseInt(e.target.value) || 30,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            className={cn(
                              "h-6 w-6 rounded-full border-2",
                              editForm.color === c
                                ? "border-foreground"
                                : "border-transparent",
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() =>
                              setEditForm({ ...editForm, color: c })
                            }
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editForm.defaultRoomType}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            defaultRoomType: e.target
                              .value as typeof editForm.defaultRoomType,
                          })
                        }
                      >
                        {ROOM_TYPES.map((roomType) => (
                          <option key={roomType} value={roomType}>
                            {t(`settings.types.room.${roomType}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={
                            !isAppointmentTypeNameValid(editForm.name) ||
                            !isDurationValid(editForm.durationMinutes) ||
                            updateMutation.isPending
                          }
                          onClick={() =>
                            updateMutation.mutate({
                              id: type.id,
                              ...editForm,
                            })
                          }
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{type.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {type.durationMinutes} {t("settings.types.minutes")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: type.color ?? "#6b7280" }}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {type.defaultRoomType ? t(`settings.types.room.${type.defaultRoomType}`) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(type.id);
                            setEditForm({
                              name: type.name,
                              durationMinutes: type.durationMinutes,
                              color: type.color ?? "#0d9488",
                              requiresDoctor: type.requiresDoctor,
                              defaultRoomType: type.defaultRoomType ?? "exam",
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate({ id: type.id })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {types?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={Calendar}
                    title={t("settings.types.empty")}
                    description={t("settings.types.emptyDescription")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CSV Helpers ──────────────────────────────────────────────
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          return val.includes(",") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ImportPreview = {
  requestKey: string;
  previewToken: string;
  total: number;
  willInsert: number;
  willReconcile?: number;
  duplicates?: number;
  unmatchedClient?: number;
  unmatchedPatient?: number;
  errors: string[];
};
type ImportMode = MigrationImportMode;
function importPreviewRequestKey(
  mode: ImportMode,
  source: string,
  csv: string,
): string {
  let hash = 2_166_136_261;
  const input = `${mode}\u0000${source}\u0000${csv}`;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${mode}:${source}:${csv.length}:${(hash >>> 0).toString(16)}`;
}
// ── Data Tab ─────────────────────────────────────────────────
function DataTab() {
  const t = useTranslations();
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [migrationSource, setMigrationSource] = useState<
    (typeof MIGRATION_SOURCES)[number]["id"] | null
  >(null);
  const importSource = migrationSource ?? "other";
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importResult, setImportResult] = useState<{
    imported: number;
    reconciled?: number;
    errors?: string[];
  } | null>(null);
  const [importRecoveryMessage, setImportRecoveryMessage] = useState("");
  const [backupFileName, setBackupFileName] = useState("");
  const [backupPayload, setBackupPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [backupSummary, setBackupSummary] = useState<{
    counts: Record<string, number>;
    missingSections: string[];
    restoreErrors: string[];
    totalRows: number;
  } | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    restored: Record<string, number>;
    totalRows: number;
  } | null>(null);
  const [confirmFreshPractice, setConfirmFreshPractice] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deletionContactEmail, setDeletionContactEmail] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [confirmExportDownloaded, setConfirmExportDownloaded] = useState(false);
  const [confirmManualReview, setConfirmManualReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRequestKeyRef = useRef<string | null>(null);
  const importFileReadVersionRef = useRef(0);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const exportClients = trpc.data.exportClients.useQuery(undefined, {
    enabled: false,
  });
  const exportPatients = trpc.data.exportPatients.useQuery(undefined, {
    enabled: false,
  });
  const exportAppointments = trpc.data.exportAppointments.useQuery(undefined, {
    enabled: false,
  });
  const exportInvoices = trpc.data.exportInvoices.useQuery(undefined, {
    enabled: false,
  });
  const exportFullBackup = trpc.data.exportFullBackup.useQuery(undefined, {
    enabled: false,
  });
  const restoreBackup = trpc.data.restoreBackup.useMutation({
    onSuccess: (data) => {
      if (data.dryRun) {
        setBackupSummary({
          counts: data.counts,
          missingSections: data.missingSections,
          restoreErrors: data.restoreErrors,
          totalRows: data.totalRows,
        });
        setRestoreResult(null);
        if (data.missingSections.length > 0) {
          toast.error(t("settings.data.backupMissing"));
        } else if (data.restoreErrors.length > 0) {
          toast.error(t("settings.data.backupInvalid"));
        } else {
          toast.success(t("settings.data.backupVerified"));
        }
        return;
      }

      setRestoreResult({
        restored: data.restored,
        totalRows: data.totalRows,
      });
      setConfirmFreshPractice(false);
      toast.success(t("settings.data.restoredRows").replace("{count}", String(data.totalRows)));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const accountDeletionRequest =
    trpc.settings.getAccountDeletionRequest.useQuery();
  const {
    data: practiceSettings,
    isLoading: practiceSettingsLoading,
    error: practiceSettingsError,
  } = trpc.settings.getPractice.useQuery();
  const practiceSettingsMissing =
    !practiceSettingsLoading && !practiceSettingsError && !practiceSettings;
  const verifiedPracticeSettings =
    practiceSettingsError || practiceSettingsMissing || !practiceSettings
      ? null
      : practiceSettings;
  const settingsTimeZone = verifiedPracticeSettings
    ? verifiedPracticeSettings.timezone
    : null;

  function handleCsvImportError(err: {
    data?: { code?: string | null } | null;
    message: string;
  }) {
    if (err.data?.code === "CONFLICT") {
      importRequestKeyRef.current = null;
      setImportPreview(null);
      setImportRecoveryMessage(
        t("settings.data.previewExpired"),
      );
      toast.error(t("settings.data.checkCsvAgain"));
      return;
    }
    toast.error(err.message);
  }

  const importClientsCsv = trpc.data.importClientsCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "clients",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          willReconcile: data.willReconcile,
          duplicates: data.duplicates,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("settings.data.clientsChecked"));
        return;
      }

      setImportResult({
        imported: data.imported ?? 0,
        reconciled: data.reconciled,
        errors: data.errors,
      });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("settings.data.clientsImported"));
    },
    onError: handleCsvImportError,
  });
  const importPatientsCsv = trpc.data.importPatientsCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "patients",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          willReconcile: data.willReconcile,
          duplicates: data.duplicates,
          unmatchedClient: data.unmatchedClient,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("settings.data.patientsChecked"));
        return;
      }

      setImportResult({
        imported: data.imported ?? 0,
        reconciled: data.reconciled,
        errors: data.errors,
      });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("settings.data.patientsImported"));
    },
    onError: handleCsvImportError,
  });
  const importVaccinationsCsv = trpc.data.importVaccinationsCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "vaccinations",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          duplicates: data.duplicates,
          unmatchedPatient: data.unmatchedPatient,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("settings.data.vaccinationsChecked"));
        return;
      }

      setImportResult({ imported: data.imported ?? 0, errors: data.errors });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("settings.data.vaccinationsImported"));
    },
    onError: handleCsvImportError,
  });
  const importSoapNotesCsv = trpc.data.importSoapNotesCsv.useMutation({
    onSuccess: (data, variables) => {
      if ("dryRun" in data && data.dryRun) {
        const requestKey = importPreviewRequestKey(
          "soapNotes",
          variables.source ?? "other",
          variables.csv,
        );
        if (importRequestKeyRef.current !== requestKey) return;
        setImportPreview({
          requestKey,
          previewToken: data.previewToken,
          total: data.total,
          willInsert: data.willInsert,
          duplicates: data.duplicates,
          unmatchedPatient: data.unmatchedPatient,
          errors: data.errors,
        });
        setImportRecoveryMessage("");
        setImportResult(null);
        toast.success(t("settings.data.historyChecked"));
        return;
      }

      setImportResult({ imported: data.imported ?? 0, errors: data.errors });
      setImportPreview(null);
      setCsvText("");
      setCsvFileName("");
      setImportRecoveryMessage("");
      toast.success(t("settings.data.historyImported"));
    },
    onError: handleCsvImportError,
  });

  const requestAccountDeletion =
    trpc.settings.requestAccountDeletion.useMutation({
      onSuccess: () => {
        utils.settings.getAccountDeletionRequest.invalidate();
        setConfirmExportDownloaded(false);
        setConfirmManualReview(false);
        toast.success("Account deletion request sent");
      },
      onError: (err) => toast.error(err.message),
    });

  const onboarding = trpc.settings.onboardingStatus.useQuery();
  const onboardingMissing =
    !onboarding.isLoading && !onboarding.error && !onboarding.data;
  const verifiedOnboardingStatus =
    onboarding.error || onboardingMissing || !onboarding.data
      ? null
      : onboarding.data;
  const hasDemo = verifiedOnboardingStatus
    ? verifiedOnboardingStatus.hasDemoData
    : false;
  const clearDemo = trpc.settings.clearDemoData.useMutation({
    onSuccess: () => {
      utils.settings.onboardingStatus.invalidate();
      toast.success(t("settings.data.sampleRemoved"));
    },
    onError: (err) => toast.error(err.message),
  });
  const reseedDemo = trpc.settings.reseedDemoData.useMutation({
    onSuccess: () => {
      utils.settings.onboardingStatus.invalidate();
      toast.success(t("settings.data.sampleAdded"));
    },
    onError: (err) => toast.error(err.message),
  });

  const handleExport = useCallback(
    async (type: "clients" | "patients" | "appointments" | "invoices") => {
      setExportingType(type);
      try {
        let data: Record<string, unknown>[] = [];
        if (type === "clients") {
          const result = await exportClients.refetch();
          data = requireSettingsExportData(
            result,
            "Could not export clients",
          ) as Record<string, unknown>[];
        } else if (type === "patients") {
          const result = await exportPatients.refetch();
          data = requireSettingsExportData(
            result,
            "Could not export patients",
          ) as Record<string, unknown>[];
        } else if (type === "appointments") {
          const result = await exportAppointments.refetch();
          data = requireSettingsExportData(
            result,
            "Could not export appointments",
          ) as Record<string, unknown>[];
        } else if (type === "invoices") {
          const result = await exportInvoices.refetch();
          // Flatten items for CSV
          const raw = requireSettingsExportData(
            result,
            "Could not export invoices",
          );
          data = raw.map((inv) => {
            const { items, ...rest } = inv;
            return {
              ...rest,
              items: items
                .map((i: { description: string }) => i.description)
                .join("; "),
            } as Record<string, unknown>;
          });
        }
        downloadCSV(data, `${type}-export.csv`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t("settings.data.exportError"),
        );
      } finally {
        setExportingType(null);
      }
    },
    [exportClients, exportPatients, exportAppointments, exportInvoices],
  );

  const handleFullBackupExport = useCallback(async () => {
    setExportingType("full-backup");
    try {
      if (!verifiedPracticeSettings) {
        throw new Error(t("settings.data.backupSettingsError"));
      }
      const result = await exportFullBackup.refetch();
      const backup = requireSettingsExportData(
        result,
        "Could not export full backup",
      );
      const date = formatSettingsDateInput(new Date(), settingsTimeZone);
      downloadJSON(backup, `doctor-pet-full-backup-${date}.json`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("settings.data.exportError"),
      );
    } finally {
      setExportingType(null);
    }
  }, [exportFullBackup, settingsTimeZone, verifiedPracticeSettings]);

  const handleBackupFileSelect = useCallback(
    (file: File) => {
      function clearBackupFile() {
        setBackupFileName("");
        setBackupPayload(null);
        setBackupSummary(null);
        setRestoreResult(null);
        setConfirmFreshPractice(false);
      }

      if (file.size > PRACTICE_BACKUP_JSON_MAX_BYTES) {
        clearBackupFile();
        toast.error(PRACTICE_BACKUP_JSON_SIZE_MESSAGE);
        return;
      }

      setBackupFileName(file.name);
      setBackupPayload(null);
      setBackupSummary(null);
      setRestoreResult(null);
      setConfirmFreshPractice(false);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = String(e.target?.result ?? "");
          if (!isPracticeBackupJsonSizeValid(text)) {
            clearBackupFile();
            toast.error(PRACTICE_BACKUP_JSON_SIZE_MESSAGE);
            return;
          }
          const parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Backup JSON must be an object");
          }
          const backup = parsed as Record<string, unknown>;
          setBackupPayload(backup);
          restoreBackup.mutate({ backup, dryRun: true });
        } catch (err) {
          setBackupFileName("");
          setBackupPayload(null);
          toast.error(
            err instanceof Error ? err.message : t("settings.data.backupReadError"),
          );
        }
      };
      reader.onerror = () => {
        clearBackupFile();
        toast.error(t("settings.data.backupReadError"));
      };
      reader.readAsText(file);
    },
    [restoreBackup],
  );

  const handleBackupRestore = useCallback(() => {
    if (!backupPayload || !confirmFreshPractice) return;
    if (!isPracticeBackupJsonSizeValid(backupPayload)) {
      toast.error(PRACTICE_BACKUP_JSON_SIZE_MESSAGE);
      return;
    }
    restoreBackup.mutate({
      backup: backupPayload,
      dryRun: false,
      confirmFreshPractice: true,
    });
  }, [backupPayload, confirmFreshPractice, restoreBackup]);

  const handleDeletionRequest = useCallback(() => {
    if (!confirmExportDownloaded || !confirmManualReview) return;
    requestAccountDeletion.mutate({
      contactEmail: deletionContactEmail.trim(),
      reason: deletionReason.trim() || undefined,
      confirmExportDownloaded: true,
      confirmManualReview: true,
    });
  }, [
    confirmExportDownloaded,
    confirmManualReview,
    deletionContactEmail,
    deletionReason,
    requestAccountDeletion,
  ]);

  const runImportPreview = useCallback(
    (text: string) => {
      if (!importMode || !migrationSource) {
        toast.error("Choose the system you are moving from first.");
        return;
      }
      setImportPreview(null);
      setImportResult(null);
      setImportRecoveryMessage("");
      importRequestKeyRef.current = importPreviewRequestKey(
        importMode,
        migrationSource,
        text,
      );
      const input = {
        csv: text,
        dryRun: true as const,
        source: migrationSource,
        migrationProtocol: "reviewed-v1" as const,
      };
      if (importMode === "clients") importClientsCsv.mutate(input);
      else if (importMode === "patients") importPatientsCsv.mutate(input);
      else if (importMode === "vaccinations")
        importVaccinationsCsv.mutate(input);
      else importSoapNotesCsv.mutate(input);
    },
    [
      importClientsCsv,
      importMode,
      importPatientsCsv,
      importSoapNotesCsv,
      importVaccinationsCsv,
      migrationSource,
    ],
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!importMode || !migrationSource) {
        toast.error("Choose the system you are moving from first.");
        return;
      }
      const readVersion = ++importFileReadVersionRef.current;
      function clearImportFile() {
        importRequestKeyRef.current = null;
        setCsvFileName("");
        setCsvText("");
        setImportPreview(null);
        setImportResult(null);
        setImportRecoveryMessage("");
      }

      if (file.size > IMPORT_CSV_MAX_BYTES) {
        clearImportFile();
        toast.error(t("settings.data.csvTooLarge"));
        return;
      }

      setCsvFileName(file.name);
      setCsvText("");
      setImportPreview(null);
      setImportResult(null);
      setImportRecoveryMessage("");
      const reader = new FileReader();
      reader.onload = (e) => {
        if (importFileReadVersionRef.current !== readVersion) return;
        const text = String(e.target?.result ?? "");
        if (!text.trim()) {
          setCsvFileName("");
          toast.error(t("settings.data.csvEmpty"));
          return;
        }
        if (!isImportCsvSizeValid(text)) {
          clearImportFile();
          toast.error(t("settings.data.csvTooLarge"));
          return;
        }

        setCsvText(text);
        runImportPreview(text);
      };
      reader.onerror = () => {
        if (importFileReadVersionRef.current !== readVersion) return;
        setCsvFileName("");
        toast.error(t("settings.data.csvReadError"));
      };
      reader.readAsText(file);
    },
    [importMode, migrationSource, runImportPreview],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleImportConfirm = useCallback(() => {
    if (!csvText || !importMode || !importPreview) return;
    if (!isImportCsvSizeValid(csvText)) {
      toast.error(t("settings.data.csvTooLarge"));
      return;
    }
    const currentRequestKey = importPreviewRequestKey(
      importMode,
      importSource,
      csvText,
    );
    if (importPreview.requestKey !== currentRequestKey) {
      importRequestKeyRef.current = null;
      setImportPreview(null);
      toast.error(t("settings.data.fileChanged"));
      return;
    }
    if (importMode === "clients") {
      importClientsCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    } else if (importMode === "patients") {
      importPatientsCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    } else if (importMode === "vaccinations") {
      importVaccinationsCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    } else {
      importSoapNotesCsv.mutate({
        csv: csvText,
        dryRun: false,
        source: importSource,
        previewToken: importPreview.previewToken,
        migrationProtocol: "reviewed-v1",
      });
    }
  }, [
    csvText,
    importMode,
    importPreview,
    importSource,
    importClientsCsv,
    importPatientsCsv,
    importVaccinationsCsv,
    importSoapNotesCsv,
  ]);

  const isImportPending =
    importClientsCsv.isPending ||
    importPatientsCsv.isPending ||
    importVaccinationsCsv.isPending ||
    importSoapNotesCsv.isPending;
  const canRestoreBackup =
    Boolean(backupPayload) &&
    Boolean(backupSummary) &&
    backupSummary?.missingSections.length === 0 &&
    backupSummary?.restoreErrors.length === 0 &&
    confirmFreshPractice &&
    !restoreBackup.isPending;
  const deletionRequest = accountDeletionRequest.data;
  const deletionSettingsMissing =
    Boolean(deletionRequest?.requestedAt) &&
    (practiceSettingsMissing || !verifiedPracticeSettings);
  const deletionRequestedAt = deletionRequest?.requestedAt
    ? formatSettingsDateTime(deletionRequest.requestedAt, settingsTimeZone)
    : null;
  const isDeletionStatusLoading =
    accountDeletionRequest.isLoading ||
    (Boolean(deletionRequest?.requestedAt) && practiceSettingsLoading);
  const deletionStatusError =
    accountDeletionRequest.error ??
    (deletionRequest?.requestedAt ? practiceSettingsError : null) ??
    (deletionSettingsMissing
      ? new Error("Could not load practice settings. Please retry.")
      : null);
  const isDeletionContactEmailValid = (email: string) =>
    email.trim().length <= SETTINGS_EMAIL_MAX_LENGTH &&
    isValidEmail(email.trim());
  const isDeletionReasonValid = (reason: string) =>
    reason.trim().length <= ACCOUNT_DELETION_REASON_MAX_LENGTH;
  const canSubmitDeletion =
    isDeletionContactEmailValid(deletionContactEmail) &&
    isDeletionReasonValid(deletionReason) &&
    confirmExportDownloaded &&
    confirmManualReview &&
    !requestAccountDeletion.isPending;

  return (
    <div className="space-y-8">
      {/* Sample data */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("settings.data.sample")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          A practice full of made up clients and pets so you can explore. Add it
          any time, and remove it when you are ready to work for real.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (!verifiedOnboardingStatus) return;
            if (hasDemo) {
              clearDemo.mutate();
            } else {
              reseedDemo.mutate();
            }
          }}
          disabled={
            onboarding.isLoading ||
            Boolean(onboarding.error) ||
            onboardingMissing ||
            !verifiedOnboardingStatus ||
            clearDemo.isPending ||
            reseedDemo.isPending
          }
        >
          {hasDemo ? t("settings.data.removeSample") : t("settings.data.addSample")}
        </Button>
        {onboarding.error || onboardingMissing ? (
          <p className="mt-2 text-xs text-destructive">
            {onboarding.error?.message ??
              t("settings.data.sampleStatusError")}
          </p>
        ) : null}
      </div>

      {/* Export Section */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("settings.data.export")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download your practice data.
        </p>
        <div className="mb-3 max-w-2xl">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled={
              exportingType !== null ||
              practiceSettingsLoading ||
              Boolean(practiceSettingsError) ||
              practiceSettingsMissing ||
              !verifiedPracticeSettings
            }
            onClick={handleFullBackupExport}
          >
            {exportingType === "full-backup" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <Database className="h-4 w-4" />
            Export Database Backup
          </Button>
          {practiceSettingsError || practiceSettingsMissing ? (
            <p className="mt-2 text-xs text-destructive">
              {practiceSettingsError?.message ??
                t("settings.data.backupSettingsError")}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Includes structured records and attachment manifests. Uploaded
            document and image bytes are not embedded in the JSON download.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          {(
            [
              { key: "clients", label: t("settings.data.exportClients"), icon: Users },
              {
                key: "patients",
                label: t("settings.data.exportPatients"),
                icon: FileSpreadsheet,
              },
              {
                key: "appointments",
                label: t("settings.data.exportAppointments"),
                icon: Calendar,
              },
              {
                key: "invoices",
                label: t("settings.data.exportInvoices"),
                icon: FileSpreadsheet,
              },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant="outline"
              className="justify-start gap-2"
              disabled={exportingType !== null}
              onClick={() => handleExport(key)}
            >
              {exportingType === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Database backup restore */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("settings.data.restore")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Restore structured data into an empty practice. Existing clients,
          patients, appointments, or invoices block the restore. A backup with
          attachment manifests must target its original practice.
        </p>
        <div className="max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-sm font-medium">Empty-practice restore</p>
                <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-200">
                  {platformBrand.productName} first checks the backup sections, row counts, and
                  internal record links. Restores are non-destructive and only
                  insert rows that do not already exist.{" "}
                  {PRACTICE_BACKUP_JSON_SIZE_MESSAGE}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 bg-background"
                  disabled={restoreBackup.isPending}
                  onClick={() => backupFileInputRef.current?.click()}
                >
                  {restoreBackup.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Choose Backup JSON
                </Button>
                {backupFileName && (
                  <span className="truncate text-xs text-amber-900 dark:text-amber-200">
                    {backupFileName}
                  </span>
                )}
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBackupFileSelect(file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              {backupSummary && (
                <div className="rounded-md border border-amber-200 bg-background/80 p-3 text-sm text-foreground dark:border-amber-900/60 dark:bg-background/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        backupSummary.missingSections.length > 0 ||
                        backupSummary.restoreErrors.length > 0
                          ? "destructive"
                          : "success"
                      }
                    >
                      {backupSummary.missingSections.length > 0
                        ? "Missing sections"
                        : backupSummary.restoreErrors.length > 0
                          ? t("settings.data.invalidBackup")
                          : t("settings.data.verified")}
                    </Badge>
                    <span className="text-muted-foreground">
                      {backupSummary.totalRows.toLocaleString()} rows detected
                    </span>
                  </div>

                  {backupSummary.missingSections.length > 0 ? (
                    <p className="mt-2 text-xs text-destructive">
                      Missing: {backupSummary.missingSections.join(", ")}
                    </p>
                  ) : backupSummary.restoreErrors.length > 0 ? (
                    <div className="mt-2 space-y-1 text-xs text-destructive">
                      {backupSummary.restoreErrors.slice(0, 3).map((error) => (
                        <p key={error}>{error}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Object.entries(backupSummary.counts)
                        .filter(([, count]) => count > 0)
                        .slice(0, 8)
                        .map(([section, count]) => (
                          <div
                            key={section}
                            className="rounded-md bg-muted/60 px-2 py-1"
                          >
                            <p className="truncate text-[11px] text-muted-foreground">
                              {section}
                            </p>
                            <p className="text-sm font-semibold">
                              {count.toLocaleString()}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {restoreResult && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4" />
                    Restored {restoreResult.totalRows.toLocaleString()} rows
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmFreshPractice}
                  disabled={
                    !backupSummary ||
                    backupSummary.missingSections.length > 0 ||
                    backupSummary.restoreErrors.length > 0 ||
                    restoreBackup.isPending
                  }
                  onChange={(e) =>
                    setConfirmFreshPractice(e.currentTarget.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  I confirm this practice has no live clients, patients,
                  appointments, or invoices.
                </span>
              </label>

              <Button
                type="button"
                className="gap-2"
                disabled={!canRestoreBackup}
                onClick={handleBackupRestore}
              >
                {restoreBackup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                Restore into Empty Practice
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Account deletion */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Account Deletion</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Start a deletion review after exporting the database backup. Review
          uploaded files separately because their bytes are not in the JSON.
        </p>
        <div className="max-w-2xl rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          {isDeletionStatusLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading deletion status
            </div>
          ) : deletionStatusError ? (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Could not load deletion status</p>
                <p className="mt-1 text-xs">{deletionStatusError.message}</p>
              </div>
            </div>
          ) : deletionRequest ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">Review requested</Badge>
                {deletionRequestedAt && (
                  <span className="text-sm text-muted-foreground">
                    {deletionRequestedAt}
                  </span>
                )}
              </div>
              <div className="grid gap-1 text-sm">
                <div>
                  <span className="font-medium">Contact:</span>{" "}
                  {deletionRequest.contactEmail}
                </div>
                <div>
                  <span className="font-medium">Requested by:</span>{" "}
                  {deletionRequest.requestedByEmail}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="account-deletion-contact"
                  className="mb-1 block text-sm font-medium"
                >
                  Contact email
                </label>
                <Input
                  id="account-deletion-contact"
                  type="email"
                  value={deletionContactEmail}
                  maxLength={SETTINGS_EMAIL_MAX_LENGTH}
                  onChange={(e) => setDeletionContactEmail(e.target.value)}
                  placeholder="owner@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="account-deletion-reason"
                  className="mb-1 block text-sm font-medium"
                >
                  Notes
                </label>
                <textarea
                  id="account-deletion-reason"
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  maxLength={ACCOUNT_DELETION_REASON_MAX_LENGTH}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Optional context for the ops review"
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmExportDownloaded}
                  onChange={(e) =>
                    setConfirmExportDownloaded(e.currentTarget.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  I downloaded the database backup before requesting deletion.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmManualReview}
                  onChange={(e) =>
                    setConfirmManualReview(e.currentTarget.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  I understand deletion needs manual retention review before
                  records are erased.
                </span>
              </label>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={!canSubmitDeletion}
                onClick={handleDeletionRequest}
              >
                {requestAccountDeletion.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Request Deletion Review
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-sm font-semibold mb-1">{t("settings.data.import")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Moving from another system? Import clients first, then patients, then
          vaccine history, then medical history (visit notes). Every file is
          dry-run first so you see duplicates and missing matches before
          anything is saved. Common column names from AVImark, Cornerstone, and
          ezyVet are recognized. Shepherd migrations are currently guided so we
          can verify the clinic's exact export format. Owner and patient IDs
          stay linked across files, even when an owner has no email.
        </p>

        {/* Where the data is coming from (export instructions per source) */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("settings.data.importFrom")}
          </span>
          {MIGRATION_SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => {
                importFileReadVersionRef.current += 1;
                importRequestKeyRef.current = null;
                setMigrationSource(source.id);
                setImportMode(null);
                setCsvText("");
                setCsvFileName("");
                setImportPreview(null);
                setImportResult(null);
                setImportRecoveryMessage("");
              }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                migrationSource === source.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {source.name}
            </button>
          ))}
        </div>
        {migrationSource ? (
          <div className="mb-4 max-w-2xl space-y-3">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <p>
                {
                  MIGRATION_SOURCES.find((s) => s.id === migrationSource)!
                    .exportHint
                }
              </p>
            </div>
            <MigrationHelpRequest source={migrationSource} />
          </div>
        ) : (
          <p className="mb-4 text-xs font-medium text-amber-700">
            {t("settings.data.chooseSource")}
          </p>
        )}

        {/* Import mode selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {MIGRATION_STEPS.map(({ mode, label }, index) => (
            <Button
              key={mode}
              variant={importMode === mode ? "default" : "outline"}
              size="sm"
              disabled={!migrationSource}
              onClick={() => {
                importFileReadVersionRef.current += 1;
                setImportMode(mode);
                setCsvText("");
                setCsvFileName("");
                setImportPreview(null);
                setImportResult(null);
                setImportRecoveryMessage("");
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              {index + 1}. Import {label}
            </Button>
          ))}
        </div>

        {importMode && (
          <div className="max-w-2xl space-y-4">
            {/* Expected columns hint */}
            <p className="text-xs text-muted-foreground">
              {t("settings.data.expectedColumns")} {" "}
              {
                MIGRATION_STEPS.find((step) => step.mode === importMode)!
                  .columnHint
              }
            </p>

            {/* Drop zone */}
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("settings.data.dropCsv")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                CSV files must be 5 MB or less. The file is dry-run first; no
                rows import until you confirm.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Existing owners connect by one exact email. Existing pets need a
                matching microchip or date of birth before an ID is connected.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            {/* Server dry-run preview */}
            {csvFileName && (
              <p className="text-xs text-muted-foreground">
                Selected file:{" "}
                <span className="font-medium">{csvFileName}</span>
              </p>
            )}

            {importRecoveryMessage && csvText ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p>{importRecoveryMessage}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={isImportPending}
                  onClick={() => runImportPreview(csvText)}
                >
                  {isImportPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Check again
                </Button>
              </div>
            ) : null}

            {importPreview && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        importPreview.willInsert > 0 ? "success" : "warning"
                      }
                    >
                      Dry run complete
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      No data has been imported yet.
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <ImportStat
                      label={t("settings.data.rowsParsed")}
                      value={importPreview.total}
                    />
                    <ImportStat
                      label={t("settings.data.willImport")}
                      value={importPreview.willInsert}
                    />
                    {typeof importPreview.duplicates === "number" && (
                      <ImportStat
                        label={t("settings.data.duplicates")}
                        value={importPreview.duplicates ?? 0}
                      />
                    )}
                    {typeof importPreview.willReconcile === "number" &&
                      importPreview.willReconcile > 0 && (
                        <ImportStat
                          label="IDs to connect"
                          value={importPreview.willReconcile}
                        />
                      )}
                    {importMode === "patients" && (
                      <ImportStat
                        label="Missing owners"
                        value={importPreview.unmatchedClient ?? 0}
                      />
                    )}
                    {(importMode === "vaccinations" ||
                      importMode === "soapNotes") && (
                      <ImportStat
                        label="Missing pets"
                        value={importPreview.unmatchedPatient ?? 0}
                      />
                    )}
                    <ImportStat
                      label={t("settings.data.rowIssues")}
                      value={importPreview.errors.length}
                    />
                  </div>

                  {importPreview.errors.length > 0 && (
                    <div className="mt-4 space-y-1">
                      <p className="text-sm font-medium text-destructive">
                        {importPreview.errors.length} row issue(s):
                      </p>
                      <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-destructive">
                        {importPreview.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="mt-4 text-xs text-muted-foreground">
                    Only the{" "}
                    {importPreview.willInsert +
                      (importPreview.willReconcile ?? 0)}{" "}
                    listed changes will be saved. {importPreview.errors.length}{" "}
                    issue row(s) will be skipped.
                  </p>
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Start with a small representative sample. A confirmed import
                    has no one-click rollback.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={
                      isImportPending ||
                      importPreview.willInsert +
                        (importPreview.willReconcile ?? 0) ===
                        0
                    }
                    onClick={handleImportConfirm}
                  >
                    {isImportPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    {t("settings.data.confirmImport")} (
                    {importPreview.willInsert +
                      (importPreview.willReconcile ?? 0)}{" "}
                    changes)
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      importFileReadVersionRef.current += 1;
                      importRequestKeyRef.current = null;
                      setCsvText("");
                      setCsvFileName("");
                      setImportPreview(null);
                      setImportRecoveryMessage("");
                    }}
                  >
                    {t("settings.data.cancel")}
                  </Button>
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  {importResult.imported} records imported successfully
                  {(importResult.reconciled ?? 0) > 0
                    ? `; ${importResult.reconciled} existing record IDs connected`
                    : ""}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      {importResult.errors.length} error(s):
                    </p>
                    <ul className="text-xs text-destructive space-y-0.5">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Mutation error */}
            {(importClientsCsv.error ||
              importPatientsCsv.error ||
              importVaccinationsCsv.error ||
              importSoapNotesCsv.error) && (
              <p className="text-sm text-destructive">
                {importClientsCsv.error?.message ??
                  importPatientsCsv.error?.message ??
                  importVaccinationsCsv.error?.message ??
                  importSoapNotesCsv.error?.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

// ── Rooms ───────────────────────────────────────────────────
function RoomsTab() {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const locationsQuery = trpc.settings.listLocations.useQuery();
  const {
    data: roomList,
    isLoading,
    error: roomsError,
    refetch: refetchRooms,
  } = trpc.settings.listRooms.useQuery();
  const createMutation = trpc.settings.createRoom.useMutation({
    onSuccess: () => {
      utils.settings.listRooms.invalidate();
      setShowAdd(false);
      setAddForm({
        name: "",
        type: "exam",
        locationId:
          locationsQuery.data?.find((location) => location.isPrimary)?.id ??
          locationsQuery.data?.[0]?.id ??
          "",
      });
      toast.success(t("settings.rooms.created"));
    },
    onError: () => toast.error(t("settings.rooms.loadError")),
  });
  const deleteMutation = trpc.settings.deleteRoom.useMutation({
    onSuccess: () => {
      utils.settings.listRooms.invalidate();
      toast.success(t("settings.rooms.deleted"));
    },
    onError: () => toast.error(t("settings.rooms.loadError")),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    type: "exam" as "exam" | "surgery" | "treatment" | "boarding",
    locationId: "",
  });
  const isRoomNameValid = (name: string) =>
    name.trim().length > 0 && name.trim().length <= ROOM_NAME_MAX_LENGTH;
  const roomsMissing = !isLoading && !roomsError && !roomList;
  const roomLocations = locationsQuery.data ?? [];

  useEffect(() => {
    if (!addForm.locationId && roomLocations.length > 0) {
      setAddForm((current) => ({
        ...current,
        locationId:
          roomLocations.find((location) => location.isPrimary)?.id ??
          roomLocations[0]!.id,
      }));
    }
  }, [addForm.locationId, roomLocations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (roomsError) {
    return <SettingsLoadError message={roomsError.message} />;
  }
  if (roomsMissing) {
    return (
      <SettingsLoadError
        title={t("settings.rooms.loadError")}
        message={t("settings.rooms.loadDescription")}
        onRetry={() => void refetchRooms()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(!showAdd)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t("settings.rooms.add")}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.rooms.new")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              placeholder={t("settings.rooms.name")}
              maxLength={ROOM_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.type}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  type: e.target.value as typeof addForm.type,
                })
              }
            >
              {ROOM_TYPES.map((roomType) => (
                <option key={roomType} value={roomType}>
                  {t(`settings.types.room.${roomType}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("settings.rooms.location")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.locationId}
              onChange={(event) =>
                setAddForm({ ...addForm, locationId: event.target.value })
              }
              disabled={locationsQuery.isLoading || roomLocations.length === 0}
            >
              <option value="">{t("settings.rooms.selectLocation")}</option>
              {roomLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !isRoomNameValid(addForm.name) ||
                !addForm.locationId ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("settings.rooms.create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("settings.rooms.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("settings.types.name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.rooms.type")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.rooms.location")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("settings.staff.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {roomList?.map((room) => (
              <tr
                key={room.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{room.name}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {t(`settings.types.room.${room.type}`)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {roomLocations.find(
                    (location) => location.id === room.locationId,
                  )?.name ?? t("settings.rooms.unassigned")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate({ id: room.id })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {roomList?.length === 0 && (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={DoorOpen}
                    title={t("settings.rooms.empty")}
                    description={t("settings.rooms.emptyDescription")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Wellness Plans ──────────────────────────────────────────
function WellnessPlansTab() {
  const t = useTranslations();
  const formatCurrency = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const {
    data: plans,
    isLoading,
    error: wellnessError,
    refetch: refetchWellnessPlans,
  } = trpc.wellness.listPlans.useQuery();
  const createMutation = trpc.wellness.createPlan.useMutation({
    onSuccess: () => {
      utils.wellness.listPlans.invalidate();
      setShowAdd(false);
      setAddForm({
        name: "",
        description: "",
        price: "",
        billingInterval: "monthly",
      });
      toast.success(t("settings.wellness.created"));
    },
    onError: () => {
      toast.error(t("settings.wellness.createError"));
    },
  });
  const setPlanActive = trpc.wellness.setPlanActive.useMutation({
    onSuccess: (_plan, variables) => {
      utils.wellness.listPlans.invalidate();
      utils.wellness.listDue.invalidate();
      toast.success(
        variables.active
          ? t("settings.wellness.reactivated")
          : t("settings.wellness.deactivated"),
      );
    },
    onError: () => {
      toast.error(t("settings.wellness.updateError"));
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{
    name: string;
    description: string;
    price: string;
    billingInterval: "monthly" | "annual";
  }>({
    name: "",
    description: "",
    price: "",
    billingInterval: "monthly",
  });
  const priceValue = Number(addForm.price);
  const canCreate =
    addForm.name.trim().length > 0 &&
    addForm.name.trim().length <= WELLNESS_PLAN_NAME_MAX_LENGTH &&
    addForm.description.trim().length <= WELLNESS_PLAN_DESCRIPTION_MAX_LENGTH &&
    isWellnessPlanPriceInputValid(addForm.price) &&
    !createMutation.isPending;
  const wellnessPlansMissing = !isLoading && !wellnessError && !plans;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (wellnessError) {
    return <SettingsLoadError message={t("settings.wellness.loadFailure")} />;
  }
  if (wellnessPlansMissing) {
    return (
      <SettingsLoadError
        title={t("settings.wellness.loadError")}
        message={t("settings.wellness.loadDescription")}
        onRetry={() => void refetchWellnessPlans()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{t("settings.wellness.scheduledBilling")}</h3>
            <Badge variant="secondary">{t("settings.wellness.noAutoCharge")}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings.wellness.scheduledBillingDescription")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("settings.wellness.add")}
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("settings.wellness.new")}</h3>
          <div className="grid gap-3 md:grid-cols-[1fr_9rem_9rem]">
            <Input
              placeholder={t("settings.wellness.name")}
              maxLength={WELLNESS_PLAN_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <Input
              type="number"
              min={WELLNESS_PLAN_PRICE_MIN}
              max={WELLNESS_PLAN_PRICE_MAX}
              step={10 ** -WELLNESS_PLAN_PRICE_SCALE}
              placeholder={t("settings.wellness.price")}
              value={addForm.price}
              onChange={(e) =>
                setAddForm({ ...addForm, price: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.billingInterval}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  billingInterval: e.target
                    .value as typeof addForm.billingInterval,
                })
              }
            >
              <option value="monthly">{t("settings.wellness.monthly")}</option>
              <option value="annual">{t("settings.wellness.annual")}</option>
            </select>
          </div>
          <Input
            placeholder={t("settings.wellness.description")}
            maxLength={WELLNESS_PLAN_DESCRIPTION_MAX_LENGTH}
            value={addForm.description}
            onChange={(e) =>
              setAddForm({ ...addForm, description: e.target.value })
            }
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() =>
                createMutation.mutate({
                  name: addForm.name.trim(),
                  description: addForm.description.trim() || undefined,
                  price: priceValue,
                  billingInterval: addForm.billingInterval,
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("settings.wellness.create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("settings.wellness.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("settings.wellness.table.name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.wellness.table.interval")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("settings.wellness.price")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.wellness.table.status")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("settings.wellness.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {plans?.map((plan) => (
              <tr
                key={plan.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{plan.name}</div>
                  {plan.description && (
                    <div className="text-sm text-muted-foreground">
                      {plan.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-muted-foreground">
                    {plan.billingInterval === "monthly"
                      ? t("settings.wellness.monthly")
                      : t("settings.wellness.annual")}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {t("settings.wellness.invoiceSchedule")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(plan.price)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={plan.active ? "default" : "secondary"}>
                    {plan.active
                      ? t("settings.wellness.active")
                      : t("settings.wellness.inactive")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setPlanActive.isPending}
                    onClick={() =>
                      setPlanActive.mutate({
                        planId: plan.id,
                        active: !plan.active,
                      })
                    }
                  >
                    {plan.active
                      ? t("settings.wellness.deactivate")
                      : t("settings.wellness.reactivate")}
                  </Button>
                </td>
              </tr>
            ))}
            {plans?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={HeartPulse}
                    title={t("settings.wellness.empty")}
                    description={t("settings.wellness.emptyDescription")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Templates ────────────────────────────────────────────────
const TEMPLATE_CATEGORIES = [
  "surgery",
  "wellness",
  "dental",
  "preventive",
  "emergency",
  "other",
] as const;

type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

function templateCategoryLabelKey(category: string | null | undefined) {
  switch (category) {
    case "surgery":
      return "settings.templates.category.surgery" as const;
    case "wellness":
      return "settings.templates.category.wellness" as const;
    case "dental":
      return "settings.templates.category.dental" as const;
    case "preventive":
      return "settings.templates.category.preventive" as const;
    case "emergency":
      return "settings.templates.category.emergency" as const;
    default:
      return "settings.templates.category.other" as const;
  }
}

const CATEGORY_BADGE: Record<string, string> = {
  surgery: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  wellness:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  dental: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  preventive:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  emergency:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

interface TemplateItem {
  draftId: number;
  itemType: "service" | "product";
  itemId?: string | null;
  description: string;
  defaultQuantity: number;
  defaultUnitPrice: string;
  sortOrder: number;
}

function TemplatesTab() {
  const t = useTranslations();
  const formatCurrency = useCurrencyFormatter();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const nextTemplateItemDraftId = useRef(1);
  const {
    data: templateList,
    isLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = trpc.templates.list.useQuery();
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success(t("settings.templates.created"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      toast.success(t("settings.templates.updated"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    category: "other" as TemplateCategory,
  });
  const [addItems, setAddItems] = useState<TemplateItem[]>([
    {
      draftId: 0,
      itemType: "service",
      itemId: null,
      description: "",
      defaultQuantity: 1,
      defaultUnitPrice: "0",
      sortOrder: 0,
    },
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const resetAddForm = () => {
    setAddForm({ name: "", description: "", category: "other" });
    setAddItems([
      {
        draftId: nextTemplateItemDraftId.current++,
        itemType: "service",
        itemId: null,
        description: "",
        defaultQuantity: 1,
        defaultUnitPrice: "0",
        sortOrder: 0,
      },
    ]);
  };

  const addItemRow = () => {
    setAddItems((currentItems) => [
      ...currentItems,
      {
        draftId: nextTemplateItemDraftId.current++,
        itemType: "service",
        itemId: null,
        description: "",
        defaultQuantity: 1,
        defaultUnitPrice: "0",
        sortOrder: currentItems.length,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    setAddItems((currentItems) =>
      currentItems.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const updateItem = (
    index: number,
    field: Exclude<keyof TemplateItem, "draftId">,
    value: string | number | null,
  ) => {
    setAddItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const changeItemType = (
    index: number,
    itemType: TemplateItem["itemType"],
  ) => {
    setAddItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              itemType,
              itemId: null,
              description: "",
              defaultUnitPrice: "0",
            }
          : item,
      ),
    );
  };

  const selectTemplateCatalogItem = (
    index: number,
    catalogItem: TemplateCatalogItem | null,
  ) => {
    setAddItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              itemId: catalogItem?.id ?? null,
              description: catalogItem?.name ?? "",
              defaultUnitPrice: catalogItem?.unitPrice ?? "0",
            }
          : item,
      ),
    );
  };

  const templateItemsToCreate = addItems
    .map((item, index) => ({
      itemType: item.itemType,
      itemId: item.itemId || undefined,
      description: item.description.trim(),
      defaultQuantity: item.defaultQuantity,
      defaultUnitPrice: item.defaultUnitPrice.trim(),
      sortOrder: index,
    }))
    .filter((item) => item.description.length > 0);
  const hasCatalogLink = (itemId?: string | null) => Boolean(itemId);
  const isTemplateItemFormValid = (item: Omit<TemplateItem, "draftId">) =>
    hasCatalogLink(item.itemId) &&
    item.description.trim().length > 0 &&
    item.description.trim().length <=
      TREATMENT_TEMPLATE_ITEM_DESCRIPTION_MAX_LENGTH &&
    isTreatmentTemplateQuantityValid(item.defaultQuantity) &&
    isTreatmentTemplateUnitPriceInputValid(item.defaultUnitPrice) &&
    isTreatmentTemplateItemTotalValid(
      item.defaultUnitPrice,
      item.defaultQuantity,
    );
  const hasUnlinkedCatalogRows = addItems.some(
    (item) => !hasCatalogLink(item.itemId),
  );
  const canCreateTemplate =
    addForm.name.trim().length > 0 &&
    addForm.name.trim().length <= TREATMENT_TEMPLATE_NAME_MAX_LENGTH &&
    addForm.description.trim().length <=
      TREATMENT_TEMPLATE_DESCRIPTION_MAX_LENGTH &&
    templateItemsToCreate.length > 0 &&
    templateItemsToCreate.length <= TREATMENT_TEMPLATE_MAX_ITEMS &&
    templateItemsToCreate.every(isTemplateItemFormValid) &&
    !hasUnlinkedCatalogRows &&
    !createMutation.isPending;

  const selectedTemplate = templateList?.find(
    (template) => template.id === selectedTemplateId,
  );
  const {
    data: selectedTemplateDetail,
    isLoading: selectedTemplateLoading,
    error: selectedTemplateError,
    refetch: refetchSelectedTemplate,
  } = trpc.templates.getById.useQuery(
    { id: selectedTemplateId! },
    { enabled: !!selectedTemplateId },
  );
  const templatesMissing = !isLoading && !templatesError && !templateList;
  const selectedTemplateMissing =
    !!selectedTemplate &&
    !selectedTemplateLoading &&
    !selectedTemplateError &&
    !selectedTemplateDetail;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (templatesError) {
    return <SettingsLoadError message={templatesError.message} />;
  }
  if (templatesMissing) {
    return (
      <SettingsLoadError
        title={t("settings.templates.loadError")}
        message={t("settings.templates.loadDescription")}
        onRetry={() => void refetchTemplates()}
      />
    );
  }

  // Detail view for a selected template
  if (selectedTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedTemplateId(null)}
          >
            <X className="mr-2 h-4 w-4" />
            {t("settings.templates.back")}
          </Button>
          <h3 className="text-sm font-semibold">{selectedTemplate.name}</h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              selectedTemplate.isActive !== false
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
            )}
          >
            {selectedTemplate.isActive !== false
              ? t("settings.templates.active")
              : t("settings.templates.inactive")}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                id: selectedTemplate.id,
                isActive: !selectedTemplate.isActive,
              })
            }
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {selectedTemplate.isActive !== false
              ? t("settings.templates.deactivate")
              : t("settings.templates.activate")}
          </Button>
        </div>

        {selectedTemplate.description && (
          <p className="text-sm text-muted-foreground">
            {selectedTemplate.description}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t("settings.templates.table.description")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("settings.templates.type")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("settings.templates.quantity")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("settings.templates.table.unitPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedTemplateError ? (
                <tr>
                  <td colSpan={4} className="p-4">
                    <SettingsLoadError
                      message={selectedTemplateError.message}
                    />
                  </td>
                </tr>
              ) : selectedTemplateLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    {t("settings.templates.loadingItems")}
                  </td>
                </tr>
              ) : selectedTemplateMissing ? (
                <tr>
                  <td colSpan={4} className="p-4">
                    <SettingsLoadError
                      title={t("settings.templates.itemsLoadError")}
                      message={t("settings.templates.itemsLoadDescription")}
                      onRetry={() => void refetchSelectedTemplate()}
                    />
                  </td>
                </tr>
              ) : selectedTemplateDetail?.items?.length ? (
                selectedTemplateDetail.items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {item.description}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span>
                        {item.itemType === "product"
                          ? t("settings.templates.product")
                          : t("settings.templates.service")}
                      </span>
                      {item.itemType === "product" &&
                      item.hasActiveProductLink !== true ? (
                        <p className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-400">
                          {t("settings.templates.missingProduct")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.defaultQuantity}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCurrency(item.defaultUnitPrice)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      className="border-0 bg-transparent p-8"
                      icon={Layers}
                      title={t("settings.templates.noItems")}
                      description={t("settings.templates.noItemsDescription")}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("settings.templates.add")}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">{t("settings.templates.new")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder={t("settings.templates.name")}
              maxLength={TREATMENT_TEMPLATE_NAME_MAX_LENGTH}
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.category}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  category: e.target.value as TemplateCategory,
                })
              }
            >
              {TEMPLATE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(templateCategoryLabelKey(category))}
                </option>
              ))}
            </select>
          </div>
          <Input
            placeholder={t("settings.templates.description")}
            maxLength={TREATMENT_TEMPLATE_DESCRIPTION_MAX_LENGTH}
            value={addForm.description}
            onChange={(e) =>
              setAddForm({ ...addForm, description: e.target.value })
            }
          />

          {/* Items */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("settings.templates.items")}</h4>
            {addItems.map((item, index) => (
              <div
                key={item.draftId}
                className="grid grid-cols-2 items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
              >
                <div className="col-span-2 min-w-0 lg:col-span-1">
                  <TemplateCatalogPicker
                    itemType={item.itemType}
                    value={item.itemId ?? null}
                    selectedLabel={item.description}
                    excludedIds={addItems
                      .filter(
                        (candidate, candidateIndex) =>
                          candidateIndex !== index &&
                          candidate.itemType === item.itemType &&
                          Boolean(candidate.itemId),
                      )
                      .map((candidate) => candidate.itemId!)}
                    formatPrice={formatCurrency}
                    onSelect={(catalogItem) =>
                      selectTemplateCatalogItem(index, catalogItem)
                    }
                  />
                </div>
                <select
                  aria-label={`${t("settings.templates.itemType")} ${index + 1}`}
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  value={item.itemType}
                  onChange={(e) =>
                    changeItemType(
                      index,
                      e.target.value as TemplateItem["itemType"],
                    )
                  }
                >
                  <option value="service">{t("settings.templates.service")}</option>
                  <option value="product">{t("settings.templates.product")}</option>
                </select>
                <Input
                  type="number"
                  placeholder={t("settings.templates.quantity")}
                  min={TREATMENT_TEMPLATE_ITEM_QUANTITY_MIN}
                  max={TREATMENT_TEMPLATE_ITEM_QUANTITY_MAX}
                  step={1}
                  className="w-full lg:w-20"
                  value={item.defaultQuantity}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "defaultQuantity",
                      parseInt(e.target.value) || 1,
                    )
                  }
                />
                <Input
                  type="number"
                  placeholder={t("settings.templates.price")}
                  min={0}
                  max={TREATMENT_TEMPLATE_UNIT_PRICE_MAX}
                  step="0.01"
                  className="w-full lg:w-28"
                  value={item.defaultUnitPrice}
                  onChange={(e) =>
                    updateItem(index, "defaultUnitPrice", e.target.value)
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${t("settings.templates.removeItem")} ${index + 1}`}
                  disabled={addItems.length <= 1}
                  onClick={() => removeItemRow(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {hasUnlinkedCatalogRows ? (
              <p className="text-sm text-muted-foreground">
                {t("settings.templates.catalogRequired")}
              </p>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={addItems.length >= TREATMENT_TEMPLATE_MAX_ITEMS}
              onClick={addItemRow}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.templates.addItem")}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!canCreateTemplate}
              onClick={() =>
                createMutation.mutate({
                  name: addForm.name.trim(),
                  description: addForm.description.trim() || undefined,
                  category: addForm.category,
                  items: templateItemsToCreate,
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("settings.templates.create")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t("settings.templates.cancel")}
            </Button>
          </div>
          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">{t("settings.templates.table.name")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.templates.table.category")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.templates.items")}</th>
              <th className="px-4 py-3 text-left font-medium">{t("settings.templates.table.status")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("settings.templates.table.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {templateList?.map((template) => (
              <tr
                key={template.id}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <td className="px-4 py-3 font-medium">{template.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      CATEGORY_BADGE[template.category ?? "other"] ??
                        CATEGORY_BADGE.other,
                    )}
                  >
                    {t(templateCategoryLabelKey(template.category))}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">—</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      template.isActive !== false
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
                    )}
                  >
                    {template.isActive !== false
                      ? t("settings.templates.active")
                      : t("settings.templates.inactive")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateMutation.mutate({
                        id: template.id,
                        isActive: !template.isActive,
                      });
                    }}
                  >
                    {template.isActive !== false ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
            {templateList?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    className="border-0 bg-transparent p-8"
                    icon={Layers}
                    title={t("settings.templates.empty")}
                    description={t("settings.templates.emptyDescription")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
