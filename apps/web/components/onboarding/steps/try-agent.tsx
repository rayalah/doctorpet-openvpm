"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Loader2, Send, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { StepHandle } from "../journey-types";
import {
  AGENT_INSTRUCTION_MAX_LENGTH,
  isAgentInstructionValid,
} from "@/lib/agent/policy";
import { useTranslations } from "@/lib/i18n/client";

/** A short, clearly-labeled sample so users see the value even with no AI key. */
function ExampleChat() {
  const t = useTranslations();
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        {t("onboarding.agent.example")}
      </div>
      <div className="space-y-3">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {t("onboarding.agent.question")}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Bot className="h-3.5 w-3.5" />
          </span>
          <div className="max-w-[85%] rounded-lg bg-emerald-50/70 px-3 py-2 text-sm leading-relaxed text-slate-700">
            {t("onboarding.agent.answer")}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 5: let the user try the built-in AI helper. If no key is set yet, show a
 * friendly note instead. Continue never blocks here.
 */
export function TryAgentStep({
  register,
}: {
  register: (h: StepHandle) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const status = trpc.agent.status.useQuery();
  const run = trpc.agent.run.useMutation();
  const [question, setQuestion] = useState(() =>
    t("onboarding.agent.question"),
  );

  useEffect(() => {
    register({ onContinue: async () => true });
  }, [register]);

  const statusMissing = !status.isLoading && !status.error && !status.data;
  const verifiedAgentStatus =
    status.error || statusMissing || !status.data ? null : status.data;
  const configured = verifiedAgentStatus
    ? verifiedAgentStatus.configured
    : false;
  const questionInvalid =
    question.length > 0 && !isAgentInstructionValid(question);
  const canAsk = Boolean(
    verifiedAgentStatus &&
    configured &&
    verifiedAgentStatus.canUseAi &&
    isAgentInstructionValid(question) &&
    !run.isPending,
  );

  function ask() {
    if (!canAsk) return;
    run.mutate({ instruction: question.trim() });
  }

  if (status.isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status.error || statusMissing) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              {statusMissing
                ? t("onboarding.agent.statusUnavailable")
                : t("onboarding.agent.statusError")}
            </p>
            <p className="mt-1 text-slate-600">
              {status.error?.message ?? t("onboarding.agent.verifyError")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void status.refetch()}
              className="mt-3"
            >
              {t("onboarding.basics.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // The error/missing branch above renders the recovery state. This additional
  // guard keeps the remaining branches fail-closed and makes the narrowed
  // status explicit to TypeScript.
  if (!verifiedAgentStatus) return null;

  if (verifiedAgentStatus.needsBillingSetup) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">
          {t("onboarding.agent.intro")}
        </p>
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("onboarding.agent.addCardTitle")}</p>
            <p className="mt-1 text-emerald-900/80">
              {t("onboarding.agent.addCardBody")}
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/settings?tab=billing")}
            >
              {t("onboarding.agent.addCard")}
            </Button>
          </div>
        </div>
        <ExampleChat />
      </div>
    );
  }

  if (!verifiedAgentStatus.canUseAi) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {verifiedAgentStatus.accessMessage ??
            t("onboarding.agent.unavailable")}
        </p>
        <ExampleChat />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">
          {t("onboarding.agent.intro")}
        </p>
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("onboarding.agent.notReady")}</p>
        </div>
        <ExampleChat />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        {t("onboarding.agent.askIntro")}
      </p>

      <ExampleChat />

      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
          maxLength={AGENT_INSTRUCTION_MAX_LENGTH}
          aria-invalid={questionInvalid || undefined}
          placeholder={t("onboarding.agent.placeholder")}
          aria-label={t("onboarding.agent.aria")}
        />
        <Button type="button" onClick={ask} disabled={!canAsk}>
          {run.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {t("onboarding.agent.ask")}
        </Button>
      </div>

      {run.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {run.error.message}
        </div>
      ) : null}

      {run.data ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-700">
            <Bot className="h-3.5 w-3.5" />
            {t("onboarding.agent.response")}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {run.data.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}
