"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ArrowLeft,
  ClipboardList,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/common/empty-state";
import { CapturePhotos } from "@/components/records/capture-photos";
import { toast } from "sonner";
import {
  hasSoapContent,
  normalizeSoapSection,
  soapSectionText,
} from "@/lib/records/soap-content";
import {
  SOAP_NOTE_TEMPLATES,
  applySoapTemplateToSections,
  getSoapTemplateById,
  hasUnresolvedSoapTemplatePrompts,
} from "@/lib/records/soap-templates";
import {
  guardedSoapNavigationDestination,
  runSoapSafeLeave,
  soapEditorNeedsLeaveGuard,
} from "@/lib/records/soap-navigation";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useLanguage, useTranslations } from "@/lib/i18n/client";
import { dateLocaleForLanguage } from "@/lib/i18n/language";

function SoapNoteEditorLoading() {
  const t = useTranslations();
  return (
    <div className="min-h-32 rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
      {t("clinicalRecords.soap.loadingEditor")}
    </div>
  );
}

const SoapNoteEditor = dynamic(
  () => import("@/components/SoapNoteEditor").then((mod) => mod.SoapNoteEditor),
  {
    ssr: false,
    loading: SoapNoteEditorLoading,
  },
);

function canCreateSoapNoteRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

/** Plain-text AI draft sections -> simple HTML the tiptap editor can load. */
function draftTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`);
  return paragraphs.join("");
}

type SoapEditorSections = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type SoapDraftSaveState =
  | "idle"
  | "offline"
  | "unsaved"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

function soapDraftFingerprint(sections: SoapEditorSections): string {
  return JSON.stringify({
    subjective: normalizeSoapSection(sections.subjective),
    objective: normalizeSoapSection(sections.objective),
    assessment: normalizeSoapSection(sections.assessment),
    plan: normalizeSoapSection(sections.plan),
  });
}

function localSoapTextForClipboard(
  sections: SoapEditorSections,
  labels: readonly [string, string, string, string],
): string {
  return [
    [labels[0], soapSectionText(sections.subjective)],
    [labels[1], soapSectionText(sections.objective)],
    [labels[2], soapSectionText(sections.assessment)],
    [labels[3], soapSectionText(sections.plan)],
  ]
    .filter((entry) => Boolean(entry[1]))
    .map(([label, content]) => `${label}\n${content}`)
    .join("\n\n");
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Clipboard API can be unavailable or denied in some managed browsers.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access was denied");
}

export default function NewSoapNotePage() {
  const t = useTranslations();
  const dateLocale = dateLocaleForLanguage(useLanguage());
  const soapSectionLabels = [
    t("clinicalRecords.subjective"),
    t("clinicalRecords.objective"),
    t("clinicalRecords.assessment"),
    t("clinicalRecords.plan"),
  ] as const;
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const canCreateSoapNote = canCreateSoapNoteRole(userRole);
  const accessDenied = status !== "loading" && !canCreateSoapNote;
  const appointmentId = searchParams.get("appointmentId") ?? undefined;
  const returnPath = appointmentId
    ? `/encounters/${encodeURIComponent(appointmentId)}`
    : "/records";

  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    SOAP_NOTE_TEMPLATES[0]?.id ?? "",
  );
  const [replaceTemplateContent, setReplaceTemplateContent] = useState(false);
  const canSave = hasSoapContent({ subjective, objective, assessment, plan });
  const hasTemplatePrompts = hasUnresolvedSoapTemplatePrompts({
    subjective,
    objective,
    assessment,
    plan,
  });
  const canSubmit = canSave && !hasTemplatePrompts;
  const selectedTemplate = getSoapTemplateById(selectedTemplateId);

  const {
    data: patient,
    isLoading: patientLoading,
    error: patientError,
  } = trpc.patients.getById.useQuery(
    { id: params.patientId },
    { enabled: !!params.patientId && canCreateSoapNote && !!appointmentId },
  );

  const draftQuery = trpc.records.getSoapDraft.useQuery(
    { patientId: params.patientId, appointmentId: appointmentId! },
    {
      enabled:
        !!params.patientId && !!appointmentId && canCreateSoapNote && !!patient,
    },
  );
  const saveDraftMutation = trpc.records.saveSoapDraft.useMutation();
  const finalizeMutation = trpc.records.finalizeSoapNote.useMutation();
  const discardMutation = trpc.records.discardSoapDraft.useMutation();
  const [draftInitialized, setDraftInitialized] = useState(false);
  const draftInitializedRef = useRef(false);
  const [saveState, setSaveState] = useState<SoapDraftSaveState>("idle");
  const isOnline = useOnlineStatus();
  const onlineStatusRef = useRef(isOnline);
  onlineStatusRef.current = isOnline;
  const wasOnlineRef = useRef(isOnline);
  const [finalizedElsewhere, setFinalizedElsewhere] = useState(false);
  const [localTextCopied, setLocalTextCopied] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [conflictDraft, setConflictDraft] = useState<NonNullable<
    typeof draftQuery.data
  > | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const lastSavedFingerprintRef = useRef("");
  const savePromiseRef = useRef<Promise<unknown> | null>(null);
  const navigationAttemptRef = useRef<Promise<boolean> | null>(null);
  const saveDraftRef = useRef(saveDraftMutation.mutateAsync);
  saveDraftRef.current = saveDraftMutation.mutateAsync;
  const conflictRef = useRef(false);
  const finalizedElsewhereRef = useRef(false);
  const localTextCopiedRef = useRef(false);
  const sectionsRef = useRef<SoapEditorSections>({
    subjective,
    objective,
    assessment,
    plan,
  });
  sectionsRef.current = { subjective, objective, assessment, plan };

  const editorNeedsLeaveGuard = useCallback(
    () =>
      soapEditorNeedsLeaveGuard({
        draftInitialized: draftInitializedRef.current,
        finalizedElsewhere: finalizedElsewhereRef.current,
        localTextCopied: localTextCopiedRef.current,
        hasLocalText: Boolean(
          localSoapTextForClipboard(sectionsRef.current, soapSectionLabels),
        ),
        conflict: conflictRef.current,
        savePending: savePromiseRef.current !== null,
        dirty:
          soapDraftFingerprint(sectionsRef.current) !==
          lastSavedFingerprintRef.current,
      }),
    [],
  );

  useEffect(() => {
    if (!draftQuery.isSuccess || draftInitialized) return;
    const draft = draftQuery.data;
    const sections = {
      subjective: draft?.subjective ?? "",
      objective: draft?.objective ?? "",
      assessment: draft?.assessment ?? "",
      plan: draft?.plan ?? "",
    };
    setSubjective(sections.subjective);
    setObjective(sections.objective);
    setAssessment(sections.assessment);
    setPlan(sections.plan);
    sectionsRef.current = sections;
    draftIdRef.current = draft?.id ?? null;
    revisionRef.current = draft?.revision ?? 0;
    lastSavedFingerprintRef.current = soapDraftFingerprint(sections);
    setLastSavedAt(draft?.updatedAt ?? null);
    setSaveState(draft ? "saved" : "idle");
    draftInitializedRef.current = true;
    setDraftInitialized(true);
  }, [draftInitialized, draftQuery.data, draftQuery.isSuccess]);

  const persistDraft = useCallback(async () => {
    if (
      finalizedElsewhereRef.current ||
      !appointmentId ||
      !params.patientId ||
      !draftInitialized
    )
      return null;

    if (!onlineStatusRef.current) {
      setSaveState("offline");
      return null;
    }

    while (true) {
      if (finalizedElsewhereRef.current) return null;
      if (conflictRef.current) return null;
      if (!onlineStatusRef.current) {
        setSaveState("offline");
        return null;
      }
      if (savePromiseRef.current) {
        await savePromiseRef.current.catch(() => null);
        continue;
      }
      const sections = { ...sectionsRef.current };
      const fingerprint = soapDraftFingerprint(sections);
      if (fingerprint === lastSavedFingerprintRef.current) {
        return draftIdRef.current
          ? { id: draftIdRef.current, revision: revisionRef.current }
          : null;
      }
      setSaveState("saving");
      const request = saveDraftRef.current({
        patientId: params.patientId,
        appointmentId,
        noteId: draftIdRef.current ?? undefined,
        expectedRevision: revisionRef.current,
        ...sections,
      });
      savePromiseRef.current = request;
      try {
        const result = await request;
        if (result.outcome === "already_finalized") {
          finalizedElsewhereRef.current = true;
          localTextCopiedRef.current = false;
          setLocalTextCopied(false);
          setFinalizedElsewhere(true);
          return null;
        }
        if (result.outcome === "conflict") {
          conflictRef.current = true;
          setConflictDraft(result.draft);
          setSaveState("conflict");
          return null;
        }
        draftIdRef.current = result.draft.id;
        revisionRef.current = result.draft.revision;
        lastSavedFingerprintRef.current = fingerprint;
        setLastSavedAt(result.draft.updatedAt);
        setSaveState("saved");
      } catch {
        if (!onlineStatusRef.current) {
          setSaveState("offline");
        } else {
          setSaveState("error");
          toast.error(t("clinicalRecords.soap.draftSaveError"));
        }
        return null;
      } finally {
        if (savePromiseRef.current === request) savePromiseRef.current = null;
      }
    }
  }, [appointmentId, draftInitialized, params.patientId]);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (
      !draftInitialized ||
      finalizedElsewhereRef.current ||
      conflictRef.current
    ) {
      return;
    }
    if (!isOnline) {
      setSaveState("offline");
      return;
    }
    if (wasOnline) return;

    const fingerprint = soapDraftFingerprint(sectionsRef.current);
    if (fingerprint === lastSavedFingerprintRef.current) {
      setSaveState(draftIdRef.current ? "saved" : "idle");
      return;
    }

    // Retry only the in-memory SOAP draft through the existing revision guard.
    // No clinical content is written to browser persistence while offline.
    setSaveState("unsaved");
    void persistDraft();
  }, [draftInitialized, isOnline, persistDraft]);

  useEffect(() => {
    if (finalizedElsewhere || !draftInitialized || conflictRef.current) return;
    const fingerprint = soapDraftFingerprint(sectionsRef.current);
    if (fingerprint === lastSavedFingerprintRef.current) return;
    if (!isOnline) {
      setSaveState("offline");
      return;
    }
    if (savePromiseRef.current) return;
    setSaveState("unsaved");
    const timer = window.setTimeout(() => void persistDraft(), 1_200);
    return () => window.clearTimeout(timer);
  }, [
    assessment,
    draftInitialized,
    finalizedElsewhere,
    isOnline,
    objective,
    persistDraft,
    plan,
    subjective,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!editorNeedsLeaveGuard()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editorNeedsLeaveGuard]);

  // AI draft availability mirrors the OpenVPM Agent (same key + model config).
  const agentStatus = trpc.agent.status.useQuery(undefined, {
    enabled: canCreateSoapNote && !!appointmentId,
  });
  const aiConfigured = agentStatus.data?.configured ?? false;
  const canUseAi = agentStatus.data?.canUseAi ?? false;
  const needsAiBillingSetup = agentStatus.data?.needsBillingSetup ?? false;
  const draftWithAi = trpc.ai.draftSoapNote.useMutation({
    onSuccess: (draft) => {
      if (finalizedElsewhereRef.current) return;
      setSubjective(draftTextToHtml(draft.subjective));
      setObjective(draftTextToHtml(draft.objective));
      setAssessment(draftTextToHtml(draft.assessment));
      setPlan(draftTextToHtml(draft.plan));
      toast.success(t("clinicalRecords.soap.draftReady"));
    },
    onError: () => toast.error(t("clinicalRecords.soap.aiUnavailableLater")),
  });

  function handleDraftWithAi() {
    if (
      finalizedElsewhereRef.current ||
      !params.patientId ||
      draftWithAi.isPending
    )
      return;
    if (
      canSave &&
      !window.confirm(t("clinicalRecords.soap.replaceWithAi"))
    ) {
      return;
    }
    draftWithAi.mutate({ patientId: params.patientId });
  }

  async function handleFinalize() {
    if (finalizedElsewhereRef.current) return;
    if (!appointmentId) {
      toast.error(t("clinicalRecords.soap.activeVisitRequired"));
      return;
    }
    if (!params.patientId || !patient) {
      toast.error(t("clinicalRecords.soap.patientRequired"));
      return;
    }
    if (!canSave) {
      toast.error(t("clinicalRecords.soap.sectionRequired"));
      return;
    }
    if (hasTemplatePrompts) {
      toast.error(t("clinicalRecords.soap.templatePromptsRequired"));
      return;
    }
    const saved = await persistDraft();
    if (!saved) return;
    if (
      !window.confirm(
        t("clinicalRecords.soap.finalizeConfirm"),
      )
    ) {
      return;
    }
    try {
      const result = await finalizeMutation.mutateAsync({
        patientId: params.patientId,
        appointmentId,
        noteId: saved.id,
        expectedRevision: saved.revision,
      });
      if (result.outcome === "conflict") {
        if (result.note.status === "finalized") {
          finalizedElsewhereRef.current = true;
          localTextCopiedRef.current = false;
          setLocalTextCopied(false);
          setFinalizedElsewhere(true);
          return;
        }
        conflictRef.current = true;
        setConflictDraft(result.note);
        setSaveState("conflict");
        return;
      }
      toast.success(t("clinicalRecords.soap.finalized"));
      router.push(returnPath);
    } catch {
      toast.error(t("clinicalRecords.soap.finalizeError"));
    }
  }

  function useServerDraft() {
    if (finalizedElsewhereRef.current || !conflictDraft) return;
    const sections = {
      subjective: conflictDraft.subjective ?? "",
      objective: conflictDraft.objective ?? "",
      assessment: conflictDraft.assessment ?? "",
      plan: conflictDraft.plan ?? "",
    };
    setSubjective(sections.subjective);
    setObjective(sections.objective);
    setAssessment(sections.assessment);
    setPlan(sections.plan);
    sectionsRef.current = sections;
    draftIdRef.current = conflictDraft.id;
    revisionRef.current = conflictDraft.revision;
    lastSavedFingerprintRef.current = soapDraftFingerprint(sections);
    setLastSavedAt(conflictDraft.updatedAt);
    conflictRef.current = false;
    setConflictDraft(null);
    setSaveState("saved");
  }

  async function overwriteServerDraft() {
    if (finalizedElsewhereRef.current || !conflictDraft) return;
    if (
      !window.confirm(
        t("clinicalRecords.soap.overwriteServerConfirm"),
      )
    )
      return;
    draftIdRef.current = conflictDraft.id;
    revisionRef.current = conflictDraft.revision;
    lastSavedFingerprintRef.current = soapDraftFingerprint({
      subjective: conflictDraft.subjective ?? "",
      objective: conflictDraft.objective ?? "",
      assessment: conflictDraft.assessment ?? "",
      plan: conflictDraft.plan ?? "",
    });
    conflictRef.current = false;
    setConflictDraft(null);
    setSaveState("unsaved");
    await persistDraft();
  }

  async function handleDiscardDraft() {
    if (finalizedElsewhereRef.current || !appointmentId || !draftIdRef.current)
      return;
    if (
      !window.confirm(
        t("clinicalRecords.soap.discardConfirm"),
      )
    )
      return;
    try {
      const result = await discardMutation.mutateAsync({
        patientId: params.patientId,
        appointmentId,
        noteId: draftIdRef.current,
        expectedRevision: revisionRef.current,
      });
      if (result.outcome === "already_finalized") {
        finalizedElsewhereRef.current = true;
        localTextCopiedRef.current = false;
        setLocalTextCopied(false);
        setFinalizedElsewhere(true);
        return;
      }
      if (result.outcome === "conflict") {
        conflictRef.current = true;
        setConflictDraft(result.draft);
        setSaveState("conflict");
        return;
      }
      toast.success(t("clinicalRecords.soap.draftDiscarded"));
      router.push(returnPath);
    } catch {
      toast.error(t("clinicalRecords.soap.draftDiscardError"));
    }
  }

  function handleApplyTemplate() {
    if (finalizedElsewhereRef.current || !selectedTemplate) return;
    const next = applySoapTemplateToSections(
      { subjective, objective, assessment, plan },
      selectedTemplate,
      { replaceExisting: replaceTemplateContent },
    );
    setSubjective(next.subjective);
    setObjective(next.objective);
    setAssessment(next.assessment);
    setPlan(next.plan);
    toast.info(
      replaceTemplateContent || !canSave
        ? `${selectedTemplate.name} ${t("clinicalRecords.soap.templateApplied")}`
        : `${selectedTemplate.name} ${t("clinicalRecords.soap.templateFilled")}`,
    );
  }

  const leaveEditorSafely = useCallback(
    (destination: string): Promise<boolean> => {
      if (navigationAttemptRef.current) {
        return navigationAttemptRef.current;
      }

      const attempt = runSoapSafeLeave({
        readState: () => ({
          finalizedElsewhere: finalizedElsewhereRef.current,
          needsGuard: editorNeedsLeaveGuard(),
          localTextCopied: localTextCopiedRef.current,
          hasLocalText: Boolean(
            localSoapTextForClipboard(sectionsRef.current, soapSectionLabels),
          ),
        }),
        persistDraft,
        confirmFinalizedLocalTextLeave: () =>
          window.confirm(
            t("clinicalRecords.soap.localTextLeaveConfirm"),
          ),
        confirmUnsavedLeave: () =>
          window.confirm(
            t("clinicalRecords.soap.unsavedLeaveConfirm"),
          ),
        navigate: () => router.push(destination),
      });

      navigationAttemptRef.current = attempt;
      void attempt.finally(() => {
        if (navigationAttemptRef.current === attempt) {
          navigationAttemptRef.current = null;
        }
      });
      return attempt;
    },
    [editorNeedsLeaveGuard, persistDraft, router, soapSectionLabels, t],
  );

  const copyLocalSoapText = useCallback(async () => {
    const text = localSoapTextForClipboard(sectionsRef.current, soapSectionLabels);
    if (!text) {
      toast.error(t("clinicalRecords.soap.noLocalText"));
      return;
    }
    try {
      await copyTextToClipboard(text);
      localTextCopiedRef.current = true;
      setLocalTextCopied(true);
      toast.success(t("clinicalRecords.soap.localTextCopied"));
    } catch {
      toast.error(t("clinicalRecords.soap.localTextCopyError"));
    }
  }, [soapSectionLabels, t]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!editorNeedsLeaveGuard() && navigationAttemptRef.current === null) {
        return;
      }
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const destination = guardedSoapNavigationDestination({
        href: anchor.href,
        currentHref: window.location.href,
        button: event.button,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
      });
      if (!destination) return;

      event.preventDefault();
      event.stopPropagation();
      void leaveEditorSafely(destination);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () =>
      document.removeEventListener("click", handleDocumentClick, true);
  }, [editorNeedsLeaveGuard, leaveEditorSafely]);

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-heading text-xl font-semibold">
          {t("clinicalRecords.soap.accessDenied")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("clinicalRecords.soap.accessDescription")}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(returnPath)}
        >
          {appointmentId
            ? t("clinicalRecords.soap.backToVisit")
            : t("clinicalRecords.soap.backToRecords")}
        </Button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("clinicalRecords.soap.checkingAccess")}
      </div>
    );
  }

  if (!appointmentId) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("clinicalRecords.soap.openActiveVisit")}
        description={t("clinicalRecords.soap.openActiveVisitDescription")}
        action={{
          label: t("clinicalRecords.soap.backToRecords"),
          onClick: () => router.push("/records"),
          icon: ArrowLeft,
        }}
      />
    );
  }

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("clinicalRecords.soap.loadingPatient")}
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t("clinicalRecords.soap.patientLoadError")}
        description={t("clinicalRecords.soap.patientLoadDescription")}
        action={{
          label: t("clinicalRecords.soap.backToRecords"),
          onClick: () => router.push("/records"),
          icon: ArrowLeft,
        }}
      />
    );
  }

  if (!draftQuery.error && (draftQuery.isLoading || !draftInitialized)) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("clinicalRecords.soap.loadingSavedDraft")}
      </div>
    );
  }

  if (draftQuery.error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t("clinicalRecords.soap.draftLoadError")}
        description={t("clinicalRecords.soap.draftLoadDescription")}
        action={{
          label: t("clinicalRecords.soap.backToVisit"),
          onClick: () => router.push(returnPath),
          icon: ArrowLeft,
        }}
      />
    );
  }

  if (finalizedElsewhere) {
    const localSections = [
      [soapSectionLabels[0], soapSectionText(subjective)],
      [soapSectionLabels[1], soapSectionText(objective)],
      [soapSectionLabels[2], soapSectionText(assessment)],
      [soapSectionLabels[3], soapSectionText(plan)],
    ].filter((entry) => Boolean(entry[1]));
    return (
      <div className="space-y-5">
        <div
          role="alert"
          className="rounded-lg border-2 border-destructive bg-destructive/10 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
            <div>
              <h2 className="font-heading text-xl font-semibold text-destructive">
                {t("clinicalRecords.soap.finalizedElsewhere")}
              </h2>
              <p className="mt-2 font-medium">
                {t("clinicalRecords.soap.finalizedElsewhereWarning")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("clinicalRecords.soap.finalizedElsewhereDescription")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">
            {t("clinicalRecords.soap.preservedLocalText")}
          </h3>
          <div className="mt-4 space-y-4">
            {localSections.length > 0 ? (
              localSections.map(([label, content]) => (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("clinicalRecords.soap.noPreservedLocalText")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void copyLocalSoapText()}
            disabled={localSections.length === 0}
          >
            {localTextCopied ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {localTextCopied
              ? t("clinicalRecords.soap.localTextCopied")
              : t("clinicalRecords.soap.copyLocalText")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void leaveEditorSafely(returnPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("clinicalRecords.soap.backToVisit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void leaveEditorSafely(
                `/patients/${encodeURIComponent(params.patientId)}`,
              )
            }
          >
            {t("clinicalRecords.soap.viewSignedChart")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void leaveEditorSafely(returnPath)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("clinicalRecords.soap.backToVisit")}
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {t("clinicalRecords.soap.documentation")}
          </h2>
          {patient && (
            <p className="text-sm text-muted-foreground">
              {t("clinicalRecords.soap.patientLabel")}: {patient.name}
              {patient.species
                ? ` - ${patient.species.charAt(0).toUpperCase() + patient.species.slice(1)}`
                : ""}
              {patient.breed ? ` (${patient.breed})` : ""}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("clinicalRecords.soap.autosaveDescription")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CapturePhotos patientId={params.patientId} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDraftWithAi}
              disabled={
                !isOnline || !aiConfigured || !canUseAi || draftWithAi.isPending
              }
            >
              {draftWithAi.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {draftWithAi.isPending
                ? t("clinicalRecords.soap.drafting")
                : t("clinicalRecords.soap.draftWithAi")}
            </Button>
          </div>
          {needsAiBillingSetup && !agentStatus.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t("clinicalRecords.soap.aiTrialCard")}</span>
              {userRole === "admin" ? (
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => router.push("/settings?tab=billing")}
                >
                  {t("clinicalRecords.soap.addCard")}
                </button>
              ) : (
                <span>{t("clinicalRecords.soap.askAdministrator")}</span>
              )}
            </div>
          ) : !canUseAi && !agentStatus.isLoading ? (
            <p className="text-xs text-muted-foreground">
              {agentStatus.data?.accessMessage ??
                t("clinicalRecords.soap.aiUnavailable")}
            </p>
          ) : !aiConfigured && !agentStatus.isLoading ? (
            <p className="text-xs text-muted-foreground">
              {t("clinicalRecords.soap.aiUnavailableLater")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm">
            {saveState === "offline" ? (
              <WifiOff className="h-4 w-4 text-amber-600" />
            ) : saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : saveState === "error" || saveState === "conflict" ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Save className="h-4 w-4 text-muted-foreground" />
            )}
            <span>
              {saveState === "saving"
                ? t("clinicalRecords.soap.savingDraft")
                : saveState === "offline"
                  ? t("clinicalRecords.soap.offline")
                  : saveState === "saved"
                    ? `${t("clinicalRecords.soap.draftSaved")}${lastSavedAt ? ` ${lastSavedAt.toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit" })}` : ""}`
                    : saveState === "error"
                      ? t("clinicalRecords.soap.saveError")
                      : saveState === "conflict"
                        ? t("clinicalRecords.soap.draftConflict")
                        : saveState === "unsaved"
                          ? t("clinicalRecords.soap.unsaved")
                          : t("clinicalRecords.soap.autosavePending")}
            </span>
          </div>
          <div className="flex gap-2">
            {isOnline && (saveState === "error" || saveState === "unsaved") ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void persistDraft()}
              >
                {t("clinicalRecords.soap.retrySave")}
              </Button>
            ) : null}
            {draftIdRef.current ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={
                  !isOnline ||
                  discardMutation.isPending ||
                  saveState === "saving"
                }
                onClick={() => void handleDiscardDraft()}
              >
                {discardMutation.isPending ? t("clinicalRecords.saving") : t("clinicalRecords.soap.discardDraft")}
              </Button>
            ) : null}
          </div>
        </div>

        {saveState === "offline" ? (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          >
            {t("clinicalRecords.soap.offlineDescription")}
          </div>
        ) : null}

        {conflictDraft ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"
          >
            <h3 className="font-medium">
              {t("clinicalRecords.soap.conflictTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("clinicalRecords.soap.conflictDescription")} {" "}
              {conflictDraft.updatedAt.toLocaleString(dateLocale)}. {" "}
              {t("clinicalRecords.soap.conflictUnchanged")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={useServerDraft}>
                {t("clinicalRecords.soap.useServerVersion")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void overwriteServerDraft()}
              >
                {t("clinicalRecords.soap.overwriteWithMyVersion")}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="w-full lg:max-w-sm">
              <label className="mb-1 block text-sm font-medium">
                {t("clinicalRecords.soap.template")}
              </label>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SOAP_NOTE_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            {canSave && (
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={replaceTemplateContent}
                  onChange={(event) =>
                    setReplaceTemplateContent(event.target.checked)
                  }
                />
                {t("clinicalRecords.soap.replaceExisting")}
              </label>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyTemplate}
              disabled={!selectedTemplate}
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              {t("clinicalRecords.soap.applyTemplate")}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("clinicalRecords.soap.templateDescription")}
          </p>
        </div>

        {hasTemplatePrompts ? (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
          >
            {t("clinicalRecords.soap.templatePromptsWarning")}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          {/* Subjective */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t("clinicalRecords.subjective")}
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("clinicalRecords.soap.subjectiveHelp")}
            </p>
            <SoapNoteEditor
              value={subjective}
              onChange={setSubjective}
              placeholder={t("clinicalRecords.soap.placeholder.subjective")}
            />
          </div>

          {/* Objective */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t("clinicalRecords.objective")}
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("clinicalRecords.soap.objectiveHelp")}
            </p>
            <SoapNoteEditor
              value={objective}
              onChange={setObjective}
              placeholder={t("clinicalRecords.soap.placeholder.objective")}
            />
          </div>

          {/* Assessment */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t("clinicalRecords.assessment")}
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("clinicalRecords.soap.assessmentHelp")}
            </p>
            <SoapNoteEditor
              value={assessment}
              onChange={setAssessment}
              placeholder={t("clinicalRecords.soap.placeholder.assessment")}
            />
          </div>

          {/* Plan */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("clinicalRecords.plan")}</label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("clinicalRecords.soap.planHelp")}
            </p>
            <SoapNoteEditor
              value={plan}
              onChange={setPlan}
              placeholder={t("clinicalRecords.soap.placeholder.plan")}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => void handleFinalize()}
            disabled={
              finalizeMutation.isPending ||
              !isOnline ||
              saveState === "saving" ||
              saveState === "error" ||
              saveState === "conflict" ||
              !canSubmit
            }
          >
            <Save className="mr-2 h-4 w-4" />
            {finalizeMutation.isPending
              ? t("clinicalRecords.soap.finalizing")
              : t("clinicalRecords.soap.finalize")}
          </Button>
          {!canSave ? (
            <p className="text-sm text-muted-foreground">
              {t("clinicalRecords.soap.sectionRequiredHelp")}
            </p>
          ) : hasTemplatePrompts ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t("clinicalRecords.soap.templatePromptsHelp")}
            </p>
          ) : null}
          <Button
            variant="outline"
            onClick={() => void leaveEditorSafely(returnPath)}
          >
            {t("clinicalRecords.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
