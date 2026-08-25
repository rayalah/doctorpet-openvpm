"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n/client";
import { patientStatusLabel, sexLabel, speciesLabel } from "@/lib/i18n/presentation-labels";
import {
  PATIENT_BREED_MAX_LENGTH,
  PATIENT_COLOR_MAX_LENGTH,
  PATIENT_MICROCHIP_NUMBER_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  isOptionalPatientTextValid,
  isRequiredPatientTextValid,
} from "@/lib/patients/policy";

function EditPatientLoadingPanel() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading patient...
    </div>
  );
}

const speciesOptions = [
  { value: "canine" }, { value: "feline" }, { value: "avian" }, { value: "rabbit" }, { value: "reptile" }, { value: "equine" }, { value: "other" },
] as const;

const sexOptions = [
  { value: "male" }, { value: "female" }, { value: "male_neutered" }, { value: "female_spayed" },
] as const;

const statusOptions = [
  { value: "active" }, { value: "inactive" }, { value: "deceased" },
] as const;

export default function EditPatientPage() {
  const t = useTranslations();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking patient access...
      </div>
    );
  }

  if (!canManagePatientFormRole(session?.user?.role)) {
    return (
      <div className="max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/patients/${params.id}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patient
        </Button>
        <EmptyState
          icon={AlertCircle}
          title="Patient actions are read-only"
          description="Only staff roles with patient write access can edit patients."
          action={{
            label: "Back to Patient",
            onClick: () => router.push(`/patients/${params.id}`),
          }}
        />
      </div>
    );
  }

  return <EditPatientForm />;
}

function canManagePatientFormRole(role?: string | null): boolean {
  return (
    role === "admin" ||
    role === "veterinarian" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function EditPatientForm() {
  const t = useTranslations();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: "",
    species: "canine" as string,
    breed: "",
    sex: "" as string,
    dob: "",
    color: "",
    microchipNumber: "",
    status: "active" as string,
  });
  const [error, setError] = useState<string | null>(null);

  const {
    data: patient,
    isLoading,
    error: loadError,
  } = trpc.patients.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  );

  useEffect(() => {
    if (patient) {
      setForm({
        name: patient.name ?? "",
        species: patient.species ?? "canine",
        breed: patient.breed ?? "",
        sex: patient.sex ?? "",
        dob: patient.dob ?? "",
        color: patient.color ?? "",
        microchipNumber: patient.microchipNumber ?? "",
        status: patient.status ?? "active",
      });
    }
  }, [patient]);

  const updatePatient = trpc.patients.update.useMutation({
    onSuccess: (updatedPatient) => {
      utils.patients.getById.setData({ id: params.id }, (currentPatient) =>
        currentPatient
          ? { ...currentPatient, ...updatedPatient }
          : currentPatient
      );
      toast.success(t("patients.updatedToast"));
      router.push(`/patients/${params.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });

  const canSubmit =
    isRequiredPatientTextValid(form.name, PATIENT_NAME_MAX_LENGTH) &&
    isOptionalPatientTextValid(form.breed, PATIENT_BREED_MAX_LENGTH) &&
    isOptionalPatientTextValid(form.color, PATIENT_COLOR_MAX_LENGTH) &&
    isOptionalPatientTextValid(
      form.microchipNumber,
      PATIENT_MICROCHIP_NUMBER_MAX_LENGTH
    );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const submittedDob = (
      e.currentTarget.elements.namedItem("dob") as HTMLInputElement | null
    )?.value ?? form.dob;

    if (!patient) {
      setError("Load the patient before saving changes.");
      return;
    }
    if (!form.name.trim()) {
      setError(t("patients.nameRequired"));
      return;
    }
    if (!canSubmit) {
      setError(t("patients.requiredError"));
      return;
    }

    updatePatient.mutate({
      id: params.id,
      name: form.name.trim(),
      species: form.species as any,
      breed: form.breed.trim() || undefined,
      sex: form.sex ? (form.sex as any) : undefined,
      dob: submittedDob || null,
      color: form.color.trim() || undefined,
      microchipNumber: form.microchipNumber.trim() || undefined,
      status: form.status as any,
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return <EditPatientLoadingPanel />;
  }

  if (loadError || !patient) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Unable to load patient"
        description={
          loadError?.message ??
          "Choose a patient from the Patients list before editing."
        }
        action={{
          label: "Back to Patients",
          onClick: () => router.push("/patients"),
          icon: ArrowLeft,
        }}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/patients/${params.id}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Patient
      </Button>

      <h2 className="font-heading text-xl font-semibold">{t("patients.edit")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Update patient information
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="name">
            {t("patients.name")} *
          </label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder={t("patients.namePlaceholder")}
            className="mt-1"
            maxLength={PATIENT_NAME_MAX_LENGTH}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="species">
              {t("patients.species")} *
            </label>
            <select
              id="species"
              value={form.species}
              onChange={(e) => updateField("species", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {speciesOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {speciesLabel(t, opt.value)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="breed">
              {t("patients.breed")}
            </label>
            <Input
              id="breed"
              value={form.breed}
              onChange={(e) => updateField("breed", e.target.value)}
              placeholder={t("patients.breedPlaceholder")}
              className="mt-1"
              maxLength={PATIENT_BREED_MAX_LENGTH}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="sex">
              {t("patients.sex")}
            </label>
            <select
              id="sex"
              value={form.sex}
              onChange={(e) => updateField("sex", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("patients.selectSex")}</option>
              {sexOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {sexLabel(t, opt.value)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="dob">
              {t("patients.birthDate")}
            </label>
            <Input
              id="dob"
              name="dob"
              type="date"
              value={form.dob}
              onChange={(e) => updateField("dob", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="color">
              {t("patients.color")}
            </label>
            <Input
              id="color"
              value={form.color}
              onChange={(e) => updateField("color", e.target.value)}
              placeholder={t("patients.colorPlaceholder")}
              className="mt-1"
              maxLength={PATIENT_COLOR_MAX_LENGTH}
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="microchipNumber">
              {t("patients.microchip")}
            </label>
            <Input
              id="microchipNumber"
              value={form.microchipNumber}
              onChange={(e) => updateField("microchipNumber", e.target.value)}
              placeholder={t("patients.microchipPlaceholder")}
              className="mt-1"
              maxLength={PATIENT_MICROCHIP_NUMBER_MAX_LENGTH}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="status">
            {t("patients.status")}
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => updateField("status", e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {patientStatusLabel(t, opt.value)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={!canSubmit || updatePatient.isPending}>
            {updatePatient.isPending ? t("patients.saving") : t("patients.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/patients/${params.id}`)}
          >
            {t("patients.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
