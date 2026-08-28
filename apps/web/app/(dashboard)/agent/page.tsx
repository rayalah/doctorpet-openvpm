"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bot,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CreditCard,
  Wrench,
  Loader2,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import {
  emitGuideSignal,
  GUIDE_SIGNALS,
} from "@/components/tour/guide-signals";
import {
  AGENT_INSTRUCTION_MAX_LENGTH,
  isAgentInstructionValid,
} from "@/lib/agent/policy";
import { useTranslations } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/messages";

const SUGGESTION_KEYS = [
  "guides.prompt.vaccinesOverdue",
  "guides.prompt.appointmentsSummary",
  "guides.prompt.carprofenDose",
  "guides.prompt.nextPatientSummary",
] as const;

type ToolCall = { name: string; input: unknown; error?: string | null };
type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  isError?: boolean;
};

function canRunAgentRole(role?: string | null): boolean {
  return role === "admin" || role === "veterinarian";
}

export default function AgentPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("guides.agent.checkingAccess")}
        </div>
      </div>
    );
  }

  if (!canRunAgentRole(session?.user?.role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Bot}
          title={t("guides.agent.restricted.title")}
          description={t("guides.agent.restricted.description")}
          action={{
            label: t("guides.agent.backDashboard"),
            onClick: () => router.push("/"),
          }}
        />
      </div>
    );
  }

  return <AgentRunner isAdmin={session?.user?.role === "admin"} t={t} />;
}

function AgentRunner({
  isAdmin,
  t,
}: {
  isAdmin: boolean;
  t: Translator;
}) {
  const router = useRouter();
  const status = trpc.agent.status.useQuery();
  const run = trpc.agent.run.useMutation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instruction, setInstruction] = useState("");
  const [allowWrites, setAllowWrites] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefilled = useRef(false);

  // One-shot ?ask= prefill (guides deep-link here with a ready question).
  // The param is stripped right away so a refresh will not re-fill.
  useEffect(() => {
    if (prefilled.current || typeof window === "undefined") return;
    prefilled.current = true;
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (ask?.trim()) {
      setInstruction(ask.trim().slice(0, AGENT_INSTRUCTION_MAX_LENGTH));
      router.replace("/agent");
      textareaRef.current?.focus();
    }
  }, [router]);

  const statusMissing = !status.isLoading && !status.error && !status.data;
  const verifiedAgentStatus =
    status.error || statusMissing || !status.data ? null : status.data;
  const configured = verifiedAgentStatus
    ? verifiedAgentStatus.configured
    : false;
  const canUseAi = verifiedAgentStatus?.canUseAi ?? false;
  const needsBillingSetup = verifiedAgentStatus?.needsBillingSetup ?? false;
  const canRun = !status.isLoading && configured && canUseAi;
  const instructionInvalid =
    instruction.length > 0 && !isAgentInstructionValid(instruction);
  const submitDisabled =
    !canRun || !isAgentInstructionValid(instruction) || run.isPending;
  const hasConversation = messages.length > 0;
  const lastReplyId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isError)?.id;
  const suggestions = SUGGESTION_KEYS.map((key) => t(key));

  // Signal the tour AFTER the reply is committed to the DOM so its next step
  // can spotlight the answer. Firing from onSuccess ran before render, and
  // the tour moved on from a reply that was not on screen yet.
  const signaledReplyId = useRef<number | null>(null);
  useEffect(() => {
    if (lastReplyId == null || signaledReplyId.current === lastReplyId) return;
    signaledReplyId.current = lastReplyId;
    emitGuideSignal(GUIDE_SIGNALS.agentRunSucceeded);
  }, [lastReplyId]);

  useEffect(() => {
    if (!canRun && allowWrites) {
      setAllowWrites(false);
    }
  }, [allowWrites, canRun]);

  // Auto-scroll to the newest message (or the typing indicator) as it arrives.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, run.isPending]);

  function nextId() {
    idRef.current += 1;
    return idRef.current;
  }

  function submit() {
    if (submitDisabled) return;
    const text = instruction.trim();
    // Send a trailing window of the conversation for multi-turn context.
    const history = messages
      .filter((m) => !m.isError)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));
    const writes = allowWrites;
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: text },
    ]);
    setInstruction("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    run.mutate(
      {
        instruction: text,
        allowWrites: writes,
        history: history.length > 0 ? history : undefined,
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: data.text,
              toolCalls: data.toolCalls,
            },
          ]);
        },
        onError: (err) => {
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: err.message,
              isError: true,
            },
          ]);
        },
        onSettled: () => setAllowWrites(false),
      },
    );
  }

  function pickSuggestion(text: string) {
    setInstruction(text);
    textareaRef.current?.focus();
  }

  const statusBanner = status.isLoading ? (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("guides.agent.checkingStatus")}
    </div>
  ) : status.error ? (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{t("guides.agent.statusError")}</p>
        <p className="mt-1">{t("guides.agent.statusErrorBody")}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void status.refetch()}
        >
          {t("guides.agent.retry")}
        </Button>
      </div>
    </div>
  ) : statusMissing ? (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{t("guides.agent.statusUnavailable")}</p>
        <p className="mt-1">
          {t("guides.agent.statusUnavailableBody")}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void status.refetch()}
        >
          {t("guides.agent.retry")}
        </Button>
      </div>
    </div>
  ) : needsBillingSetup ? (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
      <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="font-medium">{t("guides.agent.addCardTitle")}</p>
        <p className="mt-1 text-muted-foreground">
          {t("guides.agent.addCardBody")}
        </p>
        {isAdmin ? (
          <Button
            size="sm"
            className="mt-3"
            onClick={() => router.push("/settings?tab=billing")}
          >
            {t("guides.agent.addCard")}
          </Button>
        ) : (
          <p className="mt-2 text-muted-foreground">
            {t("guides.agent.askAdmin")}
          </p>
        )}
      </div>
    </div>
  ) : !canUseAi ? (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {t("guides.agent.notAvailable")}
      </p>
    </div>
  ) : !configured ? (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {verifiedAgentStatus?.hosted ? (
        // Hosted clinics can't fix a platform key. Keep it human; ops sees
        // the missing config through /api/health checks.
        <p>
          {t("guides.agent.hostedUnavailable")}
        </p>
      ) : (
        <p>
          {t("guides.agent.configure")} {" "}
          <code className="break-all font-mono">GOOGLE_VERTEX_PROJECT</code>,{" "}
          <code className="break-all font-mono">GOOGLE_VERTEX_LOCATION</code>,{" "}
          {t("guides.agent.vertexCredentials")}, {t("guides.agent.orSet")} {" "}
          <code className="break-all font-mono">ANTHROPIC_API_KEY</code>{" "}
          {t("guides.agent.forClaude")}
        </p>
      )}
    </div>
  ) : null;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">{t("guides.agent.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("guides.agent.subtitle")}
          </p>
        </div>
      </div>

      {statusBanner}

      {/* Conversation */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {!hasConversation ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-semibold">
              {t("guides.agent.emptyTitle")}
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("guides.agent.emptyDescription")}
            </p>
            <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  disabled={!canRun}
                  className="rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((m) =>
              m.id === lastReplyId ? (
                // The tour's reply beat spotlights the newest good answer.
                <div key={m.id} data-tour="agent-reply">
                <MessageBubble message={m} t={t} />
                </div>
              ) : (
                <MessageBubble key={m.id} message={m} t={t} />
              ),
            )}
            {run.isPending ? <TypingIndicator /> : null}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="mt-3 shrink-0">
        <div
          data-tour="agent-input"
          className="rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-primary/40"
        >
          <textarea
            ref={textareaRef}
            value={instruction}
            onChange={(e) => {
              setInstruction(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={AGENT_INSTRUCTION_MAX_LENGTH}
            aria-invalid={instructionInvalid || undefined}
            disabled={!canRun || run.isPending}
            placeholder={
              canRun
                ? t("guides.agent.placeholderAsk")
                : needsBillingSetup
                  ? t("guides.agent.placeholderCard")
                  : t("guides.agent.placeholderUnavailable")
            }
            className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-3 px-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={allowWrites}
                onChange={(e) => setAllowWrites(e.target.checked)}
                disabled={!canRun || run.isPending}
                className="h-3.5 w-3.5 rounded border-border"
              />
              {t("guides.agent.allowWrites")}
            </label>
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={submitDisabled}
              aria-label={t("guides.agent.send")}
              className="h-8 w-8 rounded-full"
            >
              {run.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {allowWrites ? (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              {t("guides.agent.writeMode")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  t,
}: {
  message: ChatMessage;
  t: Translator;
}) {
  const [traceOpen, setTraceOpen] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.isError
              ? "border border-destructive/30 bg-destructive/5 text-destructive"
              : "bg-muted text-foreground",
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {message.toolCalls && message.toolCalls.length > 0 ? (
          <div className="mt-3 border-t border-border/60 pt-2">
            <button
              type="button"
              onClick={() => setTraceOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {traceOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Wrench className="h-3.5 w-3.5" />
              {message.toolCalls.length}{" "}
              {message.toolCalls.length === 1
                ? t("guides.agent.toolCall")
                : t("guides.agent.toolCalls")}
            </button>
            {traceOpen ? (
              <ul className="mt-2 space-y-2">
                {message.toolCalls.map((call, i) => (
                  <li
                    key={i}
                    className={cn(
                      "rounded-md border p-2 font-mono text-xs",
                      call.error
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-border bg-surface text-muted-foreground",
                    )}
                  >
                    <div className="font-semibold text-foreground">
                      {call.name}
                    </div>
                    <div className="mt-1 break-all">
                      {JSON.stringify(call.input)}
                    </div>
                    {call.error ? (
                      <div className="mt-1">⚠ {call.error}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
