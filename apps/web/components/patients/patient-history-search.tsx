"use client";

import { useState } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatClinicalDate } from "@/lib/records/clinical-dates";
import {
  PATIENT_HISTORY_DEFAULT_PAGE_SIZE,
  PATIENT_HISTORY_RECORD_TYPES,
  type PatientHistoryRecordType,
  type PatientHistoryStateFilter,
} from "@/lib/records/patient-history";
import { trpc } from "@/lib/trpc";
import { useLanguage, useTranslations } from "@/lib/i18n/client";
import { dateLocaleForLanguage } from "@/lib/i18n/language";

type HistoryCursor = {
  occurredAt: string;
  recordType: PatientHistoryRecordType;
  id: string;
};

type AppliedFilters = {
  query?: string;
  recordTypes: PatientHistoryRecordType[];
  state: PatientHistoryStateFilter;
  fromDate?: string;
  toDate?: string;
};

export function PatientHistorySearch({
  patientId,
  timeZone,
  onSearchModeChange,
}: {
  patientId: string;
  timeZone?: string | null;
  onSearchModeChange: (active: boolean) => void;
}) {
  const t = useTranslations();
  const dateLocale = dateLocaleForLanguage(useLanguage());
  const recordTypeLabels: Record<PatientHistoryRecordType, string> = {
    soap_note: t("clinicalRecords.history.type.soap_note"),
    prescription: t("clinicalRecords.history.type.prescription"),
    vaccination: t("clinicalRecords.history.type.vaccination"),
    lab_result: t("clinicalRecords.history.type.lab_result"),
    procedure: t("clinicalRecords.history.type.procedure"),
    problem: t("clinicalRecords.history.type.problem"),
    vital_sign: t("clinicalRecords.history.type.vital_sign"),
    allergy: t("clinicalRecords.history.type.allergy"),
  };
  const stateLabels: Record<PatientHistoryStateFilter, string> = {
    all: t("clinicalRecords.history.allRecords"),
    current: t("clinicalRecords.history.current"),
    corrected: t("clinicalRecords.history.correctedRetained"),
  };
  const statusLabel = (value: string) => value.replaceAll("_", " ");
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recordTypes, setRecordTypes] = useState<PatientHistoryRecordType[]>([
    ...PATIENT_HISTORY_RECORD_TYPES,
  ]);
  const [state, setState] = useState<PatientHistoryStateFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<HistoryCursor | null>>([
    null,
  ]);

  function inputFor(filters: AppliedFilters, cursor: HistoryCursor | null) {
    return {
      patientId,
      ...filters,
      cursor: cursor ?? undefined,
      limit: PATIENT_HISTORY_DEFAULT_PAGE_SIZE,
    };
  }

  const currentCursor = cursorStack.at(-1) ?? null;
  const search = trpc.records.searchPatientHistory.useQuery(
    inputFor(
      applied ?? {
        recordTypes: [...PATIENT_HISTORY_RECORD_TYPES],
        state: "all",
      },
      currentCursor,
    ),
    { enabled: applied !== null, retry: false },
  );

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    if (fromDate && toDate && fromDate > toDate) {
      setDateError(t("clinicalRecords.history.dateRangeError"));
      return;
    }
    setDateError(null);
    const filters: AppliedFilters = {
      query: query.trim() || undefined,
      recordTypes,
      state,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    };
    setApplied(filters);
    onSearchModeChange(true);
    setCursorStack([null]);
  }

  function clearFilters() {
    setQuery("");
    setRecordTypes([...PATIENT_HISTORY_RECORD_TYPES]);
    setState("all");
    setFromDate("");
    setToDate("");
    setDateError(null);
    setApplied(null);
    onSearchModeChange(false);
    setCursorStack([null]);
  }

  function toggleRecordType(recordType: PatientHistoryRecordType) {
    setRecordTypes((current) => {
      if (current.includes(recordType)) {
        return current.length === 1
          ? current
          : current.filter((candidate) => candidate !== recordType);
      }
      return PATIENT_HISTORY_RECORD_TYPES.filter(
        (candidate) => current.includes(candidate) || candidate === recordType,
      );
    });
  }

  function goToNextPage() {
    if (!applied || !search.data?.nextCursor) return;
    const nextCursor = search.data.nextCursor;
    setCursorStack((current) => [...current, nextCursor]);
  }

  function goToPreviousPage() {
    if (!applied || cursorStack.length <= 1) return;
    const nextStack = cursorStack.slice(0, -1);
    setCursorStack(nextStack);
  }

  function retry() {
    if (!applied) return;
    void search.refetch();
  }

  if (!panelOpen) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{t("clinicalRecords.findPatientHistory")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("clinicalRecords.findHistoryDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => setPanelOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            {t("clinicalRecords.findHistory")}
          </Button>
        </div>
      </div>
    );
  }

  const pageNumber = cursorStack.length;
  const pageStart = search.data?.items.length
    ? (pageNumber - 1) * PATIENT_HISTORY_DEFAULT_PAGE_SIZE + 1
    : 0;
  const pageEnd = search.data?.items.length
    ? pageStart + search.data.items.length - 1
    : 0;

  return (
    <section
      aria-label={t("clinicalRecords.findPatientHistory")}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("clinicalRecords.findPatientHistory")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("clinicalRecords.history.exactTextDescription")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label={t("clinicalRecords.history.closeFilters")}
          onClick={() => {
            clearFilters();
            setPanelOpen(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={applyFilters} className="space-y-4">
        <div>
          <label
            htmlFor="patient-history-query"
            className="text-sm font-medium"
          >
            {t("clinicalRecords.history.searchLabel")}
          </label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <Input
              id="patient-history-query"
              type="search"
              value={query}
              maxLength={120}
              autoComplete="off"
              placeholder={t("clinicalRecords.history.searchPlaceholder")}
              className="min-h-11 flex-1"
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button
              type="submit"
              className="min-h-11 w-full sm:w-auto"
              disabled={search.isFetching}
            >
              <Search className="mr-2 h-4 w-4" />
              {search.isFetching
                ? t("clinicalRecords.history.searching")
                : t("clinicalRecords.history.applyFilters")}
            </Button>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium">
            {t("clinicalRecords.history.recordTypes")}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PATIENT_HISTORY_RECORD_TYPES.map((recordType) => {
              const selected = recordTypes.includes(recordType);
              return (
                <button
                  key={recordType}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "min-h-11 rounded-full border px-3 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                  onClick={() => toggleRecordType(recordType)}
                >
                  {recordTypeLabels[recordType]}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("clinicalRecords.history.requireRecordType")}
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">
            {t("clinicalRecords.history.recordState")}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["all", "current", "corrected"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={state === value}
                className={cn(
                  "min-h-11 rounded-full border px-3 text-sm font-medium transition-colors",
                  state === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
                onClick={() => setState(value)}
              >
                {stateLabels[value]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">
            {t("clinicalRecords.history.clinicalDate")}
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted-foreground">
                {t("clinicalRecords.history.from")}
              </span>
              <Input
                type="date"
                value={fromDate}
                className="mt-1 min-h-11"
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setDateError(null);
                }}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">
                {t("clinicalRecords.history.to")}
              </span>
              <Input
                type="date"
                value={toDate}
                className="mt-1 min-h-11"
                onChange={(event) => {
                  setToDate(event.target.value);
                  setDateError(null);
                }}
              />
            </label>
          </div>
          {dateError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {dateError}
            </p>
          ) : null}
        </fieldset>

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={clearFilters}>
            {t("clinicalRecords.history.clearFilters")}
          </Button>
        </div>
      </form>

      {applied ? (
        <div
          className="mt-5 border-t border-border pt-4"
          aria-busy={search.isFetching}
        >
          {search.error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {t("clinicalRecords.history.searchError")}
                  </p>
                  <p className="mt-1 text-sm">{search.error.message}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={retry}
              >
                {t("clinicalRecords.retry")}
              </Button>
            </div>
          ) : search.isFetching && !search.data ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("clinicalRecords.history.searchingAuthorized")}
            </p>
          ) : search.data ? (
            <>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {search.data.total === 0
                  ? t("clinicalRecords.history.noMatchingRecords")
                  : `${t("clinicalRecords.history.showing")} ${pageStart}-${pageEnd} ${t("clinicalRecords.history.of")} ${search.data.total} ${t("clinicalRecords.history.matchingRecords")}`}
              </p>

              {search.data.items.length === 0 ? (
                <div className="mt-3 rounded-md border border-dashed border-border p-6 text-center">
                  <p className="font-medium">
                    {t("clinicalRecords.history.noMatchingRecords")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("clinicalRecords.history.noMatchesDescription")}
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {search.data.items.map((item) => (
                    <article
                      key={`${item.recordType}:${item.id}`}
                      className="rounded-md border border-border p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {recordTypeLabels[item.recordType]} ·{" "}
                            {formatClinicalDate(item.occurredAt, timeZone, "—", dateLocale)}
                            {item.authorLabel && item.authorName
                              ? ` · ${item.authorLabel} ${item.authorName}`
                              : ""}
                            {item.finalizerName
                              ? ` · ${t("clinicalRecords.finalizedBy")} ${item.finalizerName}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                            {statusLabel(item.status)}
                          </span>
                          {item.imported ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              {t("clinicalRecords.history.imported")}
                            </span>
                          ) : null}
                          {item.corrected ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                              {t("clinicalRecords.history.correctedRetained")}
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {t("clinicalRecords.history.current")}
                            </span>
                          )}
                          {item.replacesRecordId ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              {t("clinicalRecords.history.currentReplacement")}
                            </span>
                          ) : null}
                          {item.replacementRecordId ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {t("clinicalRecords.history.originalReplaced")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {item.summary ? (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                          {item.summary}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {t("clinicalRecords.history.noStoredText")}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {search.data.total > 0 ? (
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t("clinicalRecords.history.page")} {pageNumber}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={cursorStack.length <= 1 || search.isFetching}
                      onClick={goToPreviousPage}
                    >
                      {t("clinicalRecords.history.previous")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={!search.data.nextCursor || search.isFetching}
                      onClick={goToNextPage}
                    >
                      {t("clinicalRecords.history.next")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
          {t("clinicalRecords.history.applyToSearch")} {" "}
          {t("clinicalRecords.history.timelineBelow")}
        </p>
      )}
    </section>
  );
}
