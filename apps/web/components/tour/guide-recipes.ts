/**
 * Named guide recipes: short walkthroughs the welcome surface (and the
 * sidebar Guides entry) can launch through the shared coachmark engine in
 * tour-provider. The classic value tour is the "tour" recipe; the others are
 * the "first win" guides, built at start time from a small context object so
 * routes and copy can use live data (the demo client, the demo patient) and
 * degrade gracefully once demo data is cleared.
 *
 * Voice: simple, fourth-grade, warm, no em dashes. Benefits first.
 */

import type { GuideId } from "@/lib/welcome/cards";
import { createTranslator, type Translator } from "@/lib/i18n/messages";
import { GUIDE_SIGNALS } from "./guide-signals";
import { buildTourSteps, type TourStep } from "./tour-steps";

export interface GuideStep extends TourStep {
  /**
   * Guide signal that auto-advances past this step (see guide-signals.ts).
   * The Next button still works, so a step never blocks on the signal.
   */
  advanceOn?: string;
}

export interface GuideContext {
  /** Target client for the portal guide (demo client, else first real one). */
  portalClient?: { id: string; firstName: string } | null;
  /** First demo patient's name, e.g. "Biscuit", when demo data is present. */
  demoPatientName?: string | null;
  /** False when the AI agent has no platform key; the guide never blocks. */
  agentConfigured?: boolean;
}

export const AGENT_GUIDE_QUESTION = "Which pets are overdue for vaccines?";

function interpolate(value: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replace(`{${key}}`, replacement),
    value,
  );
}

export function buildGuideSteps(
  recipe: GuideId,
  ctx: GuideContext = {},
  t: Translator = createTranslator("en"),
): GuideStep[] {
  switch (recipe) {
    case "tour":
      return buildTourSteps({}, t);

    case "ask-ai": {
      const ready = ctx.agentConfigured !== false;
      return [
        {
          id: "ask",
          route: `/agent?ask=${encodeURIComponent(t("guides.prompt.vaccinesOverdue"))}`,
          anchor: "agent-input",
          title: t("guides.askAi.title"),
          body: ready
            ? t("guides.askAi.ready")
            : t("guides.askAi.notReady"),
          advanceOn: ready ? GUIDE_SIGNALS.agentRunSucceeded : undefined,
        },
        {
          id: "done",
          // Spotlight the real answer so the win lands. requiresAnchor lets
          // the guide end quietly if the user never pressed send.
          ...(ready ? { anchor: "agent-reply", requiresAnchor: true } : {}),
          title: t("guides.askAi.done.title"),
          body: t("guides.askAi.done.body"),
        },
      ];
    }

    case "your-day": {
      const patient = ctx.demoPatientName;
      return [
        {
          id: "schedule",
          route: "/schedule",
          anchor: "schedule-calendar",
          title: t("guides.yourDay.schedule.title"),
          body: patient
            ? interpolate(t("guides.yourDay.schedule.withPatient"), { patient })
            : t("guides.yourDay.schedule.empty"),
        },
        {
          id: "whiteboard",
          route: "/whiteboard",
          anchor: "whiteboard-board",
          title: t("guides.yourDay.whiteboard.title"),
          body: t("guides.yourDay.whiteboard.body"),
        },
        {
          id: "done",
          title: t("guides.yourDay.done.title"),
          body: t("guides.yourDay.done.body"),
        },
      ];
    }

    case "client-portal": {
      if (!ctx.portalClient) {
        return [
          {
            id: "empty",
            route: "/clients",
            title: t("guides.portal.empty.title"),
            body: t("guides.portal.empty.body"),
          },
        ];
      }
      const first = ctx.portalClient.firstName;
      return [
        {
          id: "copy",
          route: `/clients/${ctx.portalClient.id}`,
          anchor: "client-portal-link",
          title: t("guides.portal.copy.title"),
          body: interpolate(t("guides.portal.copy.body"), { first }),
          advanceOn: GUIDE_SIGNALS.portalLinkCopied,
        },
        {
          id: "done",
          title: t("guides.portal.done.title"),
          body: interpolate(t("guides.portal.done.body"), { first }),
        },
      ];
    }

    case "calendar-feed":
      return [
        {
          id: "subscribe",
          route: "/schedule",
          anchor: "calendar-subscribe",
          title: t("guides.calendar.subscribe.title"),
          body: t("guides.calendar.subscribe.body"),
          advanceOn: GUIDE_SIGNALS.calendarUrlCopied,
        },
        {
          id: "done",
          title: t("guides.calendar.done.title"),
          body: t("guides.calendar.done.body"),
        },
      ];
  }
}
