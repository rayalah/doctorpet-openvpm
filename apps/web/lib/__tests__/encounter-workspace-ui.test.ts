import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  "app/(dashboard)/encounters/[appointmentId]/page.tsx",
  "utf8",
);
const scheduleSource = readFileSync(
  "app/(dashboard)/schedule/page.tsx",
  "utf8",
);
const soapSource = readFileSync(
  "app/(dashboard)/records/new-soap/[patientId]/page.tsx",
  "utf8",
);
const encounterVitalsSource = readFileSync(
  "components/records/encounter-vitals-card.tsx",
  "utf8",
);
const patientChartSource = readFileSync(
  "app/(dashboard)/patients/[id]/page.tsx",
  "utf8",
);
const recordsSource = readFileSync("app/(dashboard)/records/page.tsx", "utf8");

describe("clinic encounter workspace", () => {
  it("opens from an appointment and keeps visit and patient context together", () => {
    expect(scheduleSource).toContain("Open visit");
    expect(scheduleSource).toContain(
      "`/encounters/${appointment.id}#visit-closeout`",
    );
    expect(scheduleSource).toContain("`/encounters/${appointment.id}`");
    expect(workspaceSource).toContain("trpc.appointments.getById.useQuery");
    expect(workspaceSource).toContain("trpc.patients.getById.useQuery");
    expect(workspaceSource).toContain('t("visit.clinicalWork")');
    expect(workspaceSource).toContain('t("visit.invoiceState")');
    expect(workspaceSource).toContain('t("visit.chargeCapture")');
  });

  it("repairs patientless appointments before allowing an exam to start", () => {
    expect(workspaceSource).toContain(
      "trpc.appointments.attachPatient.useMutation",
    );
    expect(workspaceSource).toContain('t("visit.attachBeforeCare")');
    expect(workspaceSource).toContain('t("visit.searchPatientToAttach")');
    expect(workspaceSource).toContain('t("visit.patientAttached")');
    expect(workspaceSource).toContain(
      'nextAction.status === "in_exam" && missingClinicalTarget',
    );
    expect(scheduleSource).toContain('t("appointments.patientRequiredForExam")');
  });

  it("keeps every visit work action appointment-bound through records", () => {
    for (const tab of [
      "vaccinations",
      "prescriptions",
      "labResults",
      "procedures",
    ]) {
      expect(workspaceSource).toContain(`tab=${tab}&new=1`);
    }
    expect(recordsSource).toContain("const shouldOpenNewRecord");
    expect(recordsSource).toContain("const visitContextKey");
    expect(recordsSource).toContain(
      "appliedVisitLink.current === visitContextKey",
    );
    expect(recordsSource).toContain(
      "linkedPatientQuery.data.id !== linkedPatientId",
    );
    expect(recordsSource).toContain(
      'if (linkedTab === "vaccinations") setShowVaccinationForm(true)',
    );
    expect(recordsSource).toContain(
      'if (linkedTab === "labResults") setShowLabForm(true)',
    );
    expect(recordsSource).toContain(
      'if (linkedTab === "procedures") setShowProcedureForm(true)',
    );
    expect(recordsSource).toContain('t("clinicalRecords.recordingForVisit")');
    expect(recordsSource).toContain("Leave visit context");
    expect(recordsSource).toContain("visitContextMatchesPatient");
    expect(recordsSource).toContain(
      "appointmentId: linkedAppointmentId || undefined",
    );
    expect(recordsSource).toContain("{!linkedAppointmentId ? (");
    expect(recordsSource).toContain(
      "utils.encounters.getVisitReconciliation.invalidate",
    );
  });

  it("links SOAP documentation to the appointment and returns to the visit", () => {
    expect(workspaceSource).toContain("?appointmentId=${appointmentId}");
    expect(soapSource).toContain(
      'const appointmentId = searchParams.get("appointmentId") ?? undefined',
    );
    expect(soapSource).toContain("appointmentId,");
    expect(soapSource).toContain(
      "`/encounters/${encodeURIComponent(appointmentId)}`",
    );
    expect(soapSource).toContain('t("clinicalRecords.soap.autosaveDescription")');
    expect(soapSource).toContain('t("clinicalRecords.soap.finalize")');
  });

  it("opens every SOAP editor entry as a separate document history entry", () => {
    expect(workspaceSource).toMatch(
      /<a\s+href=\{`\/records\/new-soap\/\$\{appointment\.patientId\}/,
    );
    expect(workspaceSource).toContain("<a href={props.soapDraftHref}>");
    expect(recordsSource).toMatch(
      /<a\s+href=\{`\/records\/new-soap\/\$\{encodeURIComponent\(patientId\)\}/,
    );
    expect(patientChartSource).toMatch(
      /<a\s+href=\{`\/records\/new-soap\/\$\{encodeURIComponent\(patientId\)\}/,
    );
    for (const source of [workspaceSource, recordsSource, patientChartSource]) {
      expect(source).not.toMatch(/<Link\s+href=\{`\/records\/new-soap\//);
    }
    expect(workspaceSource).not.toContain("<Link href={props.soapDraftHref}>");
  });

  it("keeps visit vitals appointment-owned and readable after closeout", () => {
    expect(workspaceSource).toContain(
      "function canRecordVitals(role?: string | null): boolean",
    );
    expect(workspaceSource).toContain('appointment.status === "in_exam"');
    expect(workspaceSource).toContain(
      'closeoutQuery.data?.closeout?.status !== "clinical_finalized"',
    );
    expect(workspaceSource).toContain(
      'closeoutQuery.data?.closeout?.status !== "completed"',
    );
    expect(workspaceSource).toContain("patientId={appointment.patientId}");
    expect(workspaceSource).toContain("appointmentId={appointment.id}");
    expect(workspaceSource).toContain(
      "visitStateReady={visitClinicalStateReady}",
    );
    expect(encounterVitalsSource).toContain(
      "trpc.vitals.listByAppointment.useQuery",
    );
    expect(encounterVitalsSource).toContain("recordVitals.mutate({");
    expect(encounterVitalsSource).toContain(
      "const vitalsReady = Boolean(vitalsQuery.data) && !vitalsQuery.error",
    );
    expect(encounterVitalsSource).toContain("canRecord &&");
    expect(encounterVitalsSource).toContain("isOnline &&");
    expect(encounterVitalsSource).toContain("vitalsReady &&");
    expect(encounterVitalsSource).toMatch(
      /recordVitals\.mutate\(\{\s+patientId,\s+appointmentId,/,
    );
    expect(encounterVitalsSource).toContain('t("visit.checkingVitalsAccess")');
    expect(encounterVitalsSource).toContain('t("visit.vitalsClosed")');
    expect(encounterVitalsSource).toContain('t("visit.vitalsRoleRestriction")');
    expect(encounterVitalsSource).toContain(
      "utils.vitals.listByPatient.invalidate({ patientId })",
    );
  });

  it("preserves patient-only vitals for historical chart entry", () => {
    expect(patientChartSource).toContain(
      "trpc.vitals.listByPatient.useQuery({ patientId })",
    );
    expect(patientChartSource).toMatch(
      /record\.mutate\(\{\s+patientId,\s+temperatureC:/,
    );
  });

  it("creates appointment-linked service and product charges with role guards", () => {
    expect(workspaceSource).toContain(
      'role === "admin" || role === "front_desk"',
    );
    expect(workspaceSource).toContain('itemType: "service" as const');
    expect(workspaceSource).toContain('itemType: "product" as const');
    expect(workspaceSource).toContain("trpc.billing.createInvoice.useMutation");
    expect(workspaceSource).toContain("appointmentId,");
    expect(workspaceSource).toContain('t("visit.createInvoiceStockDescription")');
    expect(workspaceSource).toContain("formatPrice={fmt}");
  });

  it("edits an existing unpaid draft without creating a duplicate invoice", () => {
    expect(workspaceSource).toContain(
      "trpc.billing.updateInvoiceItems.useMutation",
    );
    expect(workspaceSource).toContain('t("visit.loadingVisitCharges")');
    expect(workspaceSource).toContain('t("visit.invoiceDraftOnly")');
    expect(workspaceSource).toContain('t("visit.updateInvoice")');
    expect(workspaceSource).toContain('t("visit.updateInvoiceStockDescription")');
    expect(workspaceSource).toContain("isBillingInvoiceLineTotalValid");
  });

  it("locks charge creation until invoice state is known and surfaces failures", () => {
    expect(workspaceSource).toContain("invoiceStateReady");
    expect(workspaceSource).toContain('t("visit.confirmingInvoiceState")');
    expect(workspaceSource).toContain('t("visit.invoiceStateLocked")');
    expect(workspaceSource).toContain('t("visit.invoiceLoadError")');
    expect(workspaceSource).toContain('t("visit.noActiveInvoiceForVisit")');
    expect(workspaceSource).toContain("!invoice.isEstimate");
    expect(workspaceSource).toContain('t("visit.emptyCatalog")');
    expect(workspaceSource).toContain('t("visit.taxCurrencyLocked")');
  });

  it("requires the durable two-stage closeout instead of a direct checkout", () => {
    expect(workspaceSource).toContain("trpc.encounters.getCloseout.useQuery");
    expect(workspaceSource).toContain(
      "trpc.encounters.finalizeClinical.useMutation",
    );
    expect(workspaceSource).toContain(
      "trpc.encounters.completeVisit.useMutation",
    );
    expect(workspaceSource).toContain('t("visit.finalizeHandoff")');
    expect(workspaceSource).toContain('t("visit.billingAndHandoff")');
    expect(workspaceSource).toContain('t("visit.downloadDischarge")');
    expect(workspaceSource).toContain("defaultPayLaterDueDate");
    expect(workspaceSource).toContain('type="date"');
    expect(workspaceSource).toContain('t("visit.payLaterDueDate")');
    expect(workspaceSource).toContain("invoiceDueDate:");
    expect(workspaceSource).not.toContain(
      'return { label: "Check out", status: "checked_out" }',
    );
  });

  it("lets an admin veterinarian provider finalize a doctor-required handoff", () => {
    expect(workspaceSource).toContain(
      "trpc.settings.getMyClinicalProfile.useQuery",
    );
    expect(workspaceSource).toContain('enabled: role === "admin"');
    expect(workspaceSource).toContain(
      "clinicalProfileQuery.data?.isVeterinarian === true",
    );
  });

  it("localizes every known appointment status in the visit header", () => {
    expect(workspaceSource).toContain("function appointmentStatusLabel");
    expect(workspaceSource).toContain(
      "appointmentStatusLabel(appointment.status, t)",
    );
    expect(workspaceSource).toContain(
      'checked_out: "appointments.status.checked_out"',
    );
  });

  it("makes clinical finalization explanatory and prevents late validation", () => {
    expect(workspaceSource).toContain("finalizationIssues");
    expect(workspaceSource).toContain('t("visit.beforeFinalizing")');
    expect(workspaceSource).toContain('t("visit.documentedException")');
    expect(workspaceSource).toContain("linkedMedicationCount");
    expect(workspaceSource).toContain("disabled={!canFinalizeNow}");
  });

  it("keeps the signed owner handoff reviewable and mobile billing reachable", () => {
    expect(workspaceSource).toContain('t("visit.diagnosisSummary")');
    expect(workspaceSource).toContain('t("visit.warningSigns")');
    expect(workspaceSource).toContain('t("visit.priorFinalizedVersions")');
    expect(workspaceSource).toContain("downloadHistoricalDischarge");
    expect(workspaceSource).toContain('id="charge-capture"');
    expect(workspaceSource).toContain('href="#charge-capture"');
    expect(workspaceSource).toContain("tabIndex={-1}");
  });

  it("links prescriptions to the visit and preserves their inventory ownership", () => {
    expect(workspaceSource).toContain("tab=prescriptions&new=1");
    expect(workspaceSource).toContain("sourceDispenseChargeId");
    expect(workspaceSource).toContain('dispenseChargeStatus === "pending"');
    expect(workspaceSource).toContain('t("visit.inventoryAlreadyDispensed")');
    expect(workspaceSource).toContain("expectedUpdatedAt");
  });

  it("makes performed work reconciliation explicit without automatic billing", () => {
    expect(workspaceSource).toContain(
      "trpc.encounters.getVisitReconciliation.useQuery",
    );
    expect(workspaceSource).toContain(
      "trpc.encounters.resolveVisitWork.useMutation",
    );
    expect(workspaceSource).toContain('t("visit.performedWorkReconciliation")');
    expect(workspaceSource).toContain('t("visit.linkConfirmedCharge")');
    expect(workspaceSource).toContain('t("visit.noChargeShort")');
    expect(workspaceSource).toContain('t("visit.voidCorrected")');
    expect(workspaceSource).toContain('t("visit.addSaveLinkChargeNoSuggestion")');
  });

  it("guides the clinic through one safe visit-completion action at a time", () => {
    expect(workspaceSource).toContain('t("visit.finishThisVisit")');
    expect(workspaceSource).toContain('t("visit.completionProgress")');
    expect(workspaceSource).toContain("getVisitCompletionAction");
    expect(workspaceSource).toContain("href={actionHref}");
    expect(workspaceSource).toContain('t("visit.noChargeContinueHandoff")');
    expect(workspaceSource).toContain('t("visit.chargeHint")');
  });

  it("surfaces exact pending prescription charges without automatic billing", () => {
    expect(workspaceSource).toContain('t("visit.readyFromVisit")');
    expect(workspaceSource).toContain('t("visit.readyPrescriptionCharges")');
    expect(workspaceSource).toContain(
      "addCatalogItem(entry, entry.quantity ?? 1)",
    );
    expect(workspaceSource).toContain(
      "sourceDispenseChargeId === entry.sourceDispenseChargeId",
    );
    expect(workspaceSource).toContain('t("visit.prescriptionChargesDescription")');
    expect(workspaceSource).toContain("moneyToCents(entry.defaultPrice)");
    expect(workspaceSource).toContain('t("visit.reviewMedicationUnit")');
    expect(workspaceSource).toContain(
      "requiresPrescriptionInventoryUnitReview",
    );
    expect(workspaceSource).toContain('t("visit.legacyPackageWarning")');
  });

  it("autosaves revisioned closeout drafts and preserves local work on conflict", () => {
    expect(workspaceSource).toContain("persistCloseoutDraft");
    expect(workspaceSource).toContain("expectedRevision: revisionRef.current");
    expect(workspaceSource).toContain("clinicalDraftFingerprint");
    expect(workspaceSource).toContain("const timer = window.setTimeout(");
    expect(workspaceSource).toContain('setDraftSaveState("conflict")');
    expect(workspaceSource).toContain('t("visit.useServerVersion")');
    expect(workspaceSource).toContain('t("visit.overwriteServerVersion")');
    expect(workspaceSource).toContain(
      "async function finalizeClinicalHandoff()",
    );
    expect(workspaceSource).toContain(
      "const saved = await persistCloseoutDraft()",
    );
    expect(workspaceSource).toContain("autosaveTimerRef.current");
    expect(workspaceSource).toContain('t("visit.changesOnlyDevice")');
  });

  it("guards unsaved vitals and charges without persisting clinical data in the browser", () => {
    const guardSource = readFileSync(
      "lib/use-unsaved-changes-guard.ts",
      "utf8",
    );
    expect(encounterVitalsSource).toContain("useUnsavedChangesGuard(");
    expect(encounterVitalsSource).toContain('t("visit.offlineVitals")');
    expect(workspaceSource).toContain("hasUnsavedCharges");
    expect(workspaceSource).toContain('t("visit.unsavedChargesLeaveConfirm")');
    expect(recordsSource).toContain("const hasUnsavedRecordForm =");
    expect(recordsSource).toContain('t("clinicalRecords.unsavedRecordLeave")');
    expect(recordsSource).toContain(
      "Offline — clinical forms stay only on this device.",
    );
    expect(guardSource).toContain('window.addEventListener("beforeunload"');
    expect(guardSource).toContain(
      'document.addEventListener("click", handleDocumentClick, true)',
    );
    expect(guardSource).toContain(
      'window.addEventListener("popstate", handlePopState, true)',
    );
    expect(guardSource).toContain("HISTORY_SENTINEL_KEY");
    expect(guardSource).toContain('pendingPopAction = "restore"');
    expect(guardSource).toContain('pendingPopAction = "leave"');
    expect(guardSource).toContain("isSameDocumentHashNavigation(");
    expect(guardSource).toContain('anchor.hasAttribute("download")');
    expect(guardSource).not.toContain("window.history.pushState =");
    for (const forbiddenStorage of [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "caches.open",
      "serviceWorker",
    ]) {
      expect(workspaceSource).not.toContain(forbiddenStorage);
      expect(encounterVitalsSource).not.toContain(forbiddenStorage);
      expect(recordsSource).not.toContain(forbiddenStorage);
      expect(guardSource).not.toContain(forbiddenStorage);
    }
  });
});
