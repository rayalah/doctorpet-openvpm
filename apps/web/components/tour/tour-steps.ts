/**
 * Ordered steps for the value walk. Each step optionally navigates to a route
 * and anchors a coachmark to an element marked `data-tour="<anchor>"`. Anchoring
 * the sidebar nav links keeps anchors stable across route changes; steps without
 * an anchor render as a centered card.
 *
 * The tour is context-aware: when the workspace has sample data we walk into a
 * real chart and a real bill instead of pointing at empty tabs, and the finale
 * is the AI helper answering a real question. Voice: simple, fourth-grade,
 * warm, no em dashes. Lead with the value: you own your data and real AI tools
 * are built in.
 */
import { GUIDE_SIGNALS } from "./guide-signals";
import { createTranslator, type Translator } from "@/lib/i18n/messages";

export interface TourStep {
  id: string;
  /** Route to navigate to before showing this step. */
  route?: string;
  /** `data-tour` value of the element to spotlight. Absent = centered card. */
  anchor?: string;
  /**
   * Only visit this step while its anchor is in the DOM; Next and Back pass
   * over it otherwise (e.g. the AI reply beat when nothing was ever sent).
   */
  requiresAnchor?: boolean;
  title: string;
  body: string;
  /** Guide signal that auto-advances past this step (never blocks Next). */
  advanceOn?: string;
}

export const AGENT_TOUR_QUESTION = "Which pets are overdue for vaccines?";

export interface TourContext {
  /** First demo patient's name, e.g. "Biscuit", when demo data is present. */
  demoPatientName?: string | null;
  /** First demo patient's id, for walking into a real chart. */
  demoPatientId?: string | null;
  /** A live sample invoice id, for walking into a real bill. */
  demoInvoiceId?: string | null;
  /** False when the AI agent has no platform key; the tour never blocks. */
  agentConfigured?: boolean;
}

function interpolate(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, replacement),
    value,
  );
}

export function buildTourSteps(
  ctx: TourContext = {},
  t: Translator = createTranslator("en"),
): TourStep[] {
  const patientName = ctx.demoPatientName ?? null;
  const agentReady = ctx.agentConfigured ?? false;
  const agentQuestion = t("guides.prompt.vaccinesOverdue");

  const steps: TourStep[] = [
    {
      id: "welcome",
      route: "/",
      title: t("guides.tour.welcome.title"),
      body: t("guides.tour.welcome.body"),
    },
    {
      id: "schedule",
      route: "/schedule",
      anchor: "schedule-calendar",
      title: t("guides.tour.schedule.title"),
      body: patientName
        ? interpolate(t("guides.tour.schedule.withPatient"), { patient: patientName })
        : t("guides.tour.schedule.empty"),
    },
  ];

  if (ctx.demoPatientId) {
    steps.push({
      id: "patient-chart",
      route: `/patients/${ctx.demoPatientId}`,
      title: t("guides.tour.records.title"),
      body: interpolate(t("guides.tour.records.withPatient"), {
        patient: patientName ?? "a sample pet",
      }),
    });
  } else {
    steps.push({
      id: "records",
      route: "/records",
      anchor: "nav-/records",
      title: t("guides.tour.records.title"),
      body: t("guides.tour.records.empty"),
    });
  }

  if (ctx.demoInvoiceId) {
    steps.push({
      id: "invoice",
      route: `/billing?expand=${ctx.demoInvoiceId}`,
      anchor: "invoice-detail",
      title: t("guides.tour.billing.title"),
      body: t("guides.tour.billing.withInvoice"),
    });
  } else {
    steps.push({
      id: "billing",
      route: "/billing",
      anchor: "nav-/billing",
      title: t("guides.tour.billing.title"),
      body: t("guides.tour.billing.empty"),
    });
  }

  steps.push({
    id: "inbox",
    route: "/inbox",
    anchor: "inbox-list",
    title: t("guides.tour.inbox.title"),
    body: t("guides.tour.inbox.body"),
  });

  steps.push({
    id: "agent",
    route: `/agent?ask=${encodeURIComponent(agentQuestion)}`,
    anchor: "agent-input",
    title: t("guides.tour.agent.title"),
    body: agentReady
      ? t("guides.tour.agent.ready")
      : t("guides.tour.agent.notReady"),
    advanceOn: agentReady ? GUIDE_SIGNALS.agentRunSucceeded : undefined,
  });

  // The payoff beat: stay on the answer and spotlight it. Without this the
  // finish step navigated home the moment the reply landed, so nobody ever
  // read what the AI wrote.
  if (agentReady) {
    steps.push({
      id: "agent-reply",
      anchor: "agent-reply",
      requiresAnchor: true,
      title: t("guides.tour.agentReply.title"),
      body: t("guides.tour.agentReply.body"),
    });
  }

  steps.push({
    id: "finish",
    route: "/",
    title: t("guides.tour.finish.title"),
    body: t("guides.tour.finish.body"),
  });

  return steps;
}

/** Context-free steps, used for prefetch fallbacks and tests. */
export const TOUR_STEPS: TourStep[] = buildTourSteps();
