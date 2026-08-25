/**
 * Copy deck for the welcome surface and its Polaroid guide cards, kept as
 * data so tests can hold the voice: fourth-grade reading level, benefits
 * before features, warm, and never an em or en dash.
 */

import type { WelcomeCardId } from "@/lib/welcome/cards";
import { platformBrand } from "@/lib/brand/platform-brand";
import type { Translator } from "@/lib/i18n";

export function getWelcomeCopy(t: Translator) {
  return {
    headlineAdmin: (practiceName: string) =>
      `${t("welcome.headline.admin")} ${platformBrand.productName}, ${practiceName}!`,
    headlineStaff: (firstName: string) =>
      `${t("welcome.headline.staff")} ${firstName}!`,
    headlineFallback: `${t("welcome.headline.admin")} ${platformBrand.productName}!`,
    subline: `${t("welcome.subline.before")} ${platformBrand.productName} ${t("welcome.subline.after")}`,
    skip: t("welcome.skip"),
    reopenHint: t("welcome.reopenHint"),
    setupInstead: t("welcome.setupInstead"),
    doneBadge: t("welcome.done"),
    allDone: {
      title: t("welcome.allDone.title"),
      body: `${t("welcome.allDone.bodyBefore")} ${platformBrand.productName} ${t("welcome.allDone.bodyAfter")}`,
      accept: t("welcome.allDone.accept"),
      later: t("welcome.allDone.later"),
    },
  };
}

export interface WelcomeCardCopy {
  caption: string;
  sub: string;
  chip: string;
}

export function getWelcomeCardCopy(
  t: Translator,
): Record<WelcomeCardId, WelcomeCardCopy> {
  return {
    "ask-ai": {
      caption: t("welcome.card.askAi.caption"),
      sub: t("welcome.card.askAi.sub"),
      chip: t("welcome.card.askAi.chip"),
    },
    "your-day": {
      caption: t("welcome.card.yourDay.caption"),
      sub: t("welcome.card.yourDay.sub"),
      chip: t("welcome.card.yourDay.chip"),
    },
    "client-portal": {
      caption: t("welcome.card.portal.caption"),
      sub: t("welcome.card.portal.sub"),
      chip: t("welcome.card.portal.chip"),
    },
    "calendar-feed": {
      caption: t("welcome.card.calendar.caption"),
      sub: t("welcome.card.calendar.sub"),
      chip: t("welcome.card.calendar.chip"),
    },
  };
}

/** The animated AI vignette's scripted exchange. */
export function getAiVignette(t: Translator) {
  return {
    question: t("welcome.ai.question"),
    answer: t("welcome.ai.answer"),
  };
}
