import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGuideSteps } from "@/components/tour/guide-recipes";
import { buildTourSteps } from "@/components/tour/tour-steps";
import { createTranslator } from "@/lib/i18n/messages";
import { enGuidesMessages, esGuidesMessages } from "@/lib/i18n/messages/guides";

const context = {
  portalClient: { id: "client-1", firstName: "Jordan" },
  demoPatientName: "Biscuit",
  agentConfigured: true,
};

const deepTourContext = {
  demoPatientName: "Biscuit",
  demoPatientId: "patient-1",
  demoInvoiceId: "invoice-1",
  agentConfigured: true,
};

const namedRecipes = ["ask-ai", "your-day", "client-portal", "calendar-feed"] as const;

const knownEnglishLeaks = [
  "What can I help you with?",
  "AI is built into Doctor Pet.",
  "Ask about a pet",
  "Your AI helper turns on once your workspace key is set.",
  "Here is where you will ask it questions in plain words.",
  "Skip tour",
  "That easy",
  "The AI just read your charts so you did not have to.",
  "Ask it anything about your clinic, any time.",
  "Next",
  "Back",
  "Finish",
  "Which pets are overdue for vaccines?",
  "Summarize today's appointments.",
  "What's the carprofen dose for a 12 kg dog?",
  "Pull a clinical summary for the next patient checked in.",
];

function visibleCopy(steps: Array<{ title: string; body: string }>) {
  return steps.map((step) => `${step.title}\n${step.body}`).join("\n");
}

describe("guides and onboarding i18n", () => {
  it("keeps the English guide catalog complete in Spanish", () => {
    for (const key of Object.keys(enGuidesMessages)) {
      expect(esGuidesMessages).toHaveProperty(key);
    }
  });

  it("localizes every tour recipe while retaining the live context", () => {
    const tEs = createTranslator("es");
    const steps = [
      ...namedRecipes.flatMap((recipe) => buildGuideSteps(recipe, context, tEs)),
      ...buildTourSteps(deepTourContext, tEs),
    ];
    const copy = visibleCopy(steps);

    expect(copy).toContain("Consultá sobre un paciente");
    expect(copy).toContain("Biscuit");
    for (const leak of knownEnglishLeaks) {
      expect(copy).not.toContain(leak);
    }
  });

  it("keeps English fallback correct for the same recipes", () => {
    const tEn = createTranslator("en");
    const steps = [
      ...namedRecipes.flatMap((recipe) => buildGuideSteps(recipe, context, tEn)),
      ...buildTourSteps(deepTourContext, tEn),
    ];
    const copy = visibleCopy(steps);

    expect(copy).toContain("Ask about a pet");
    expect(buildGuideSteps("ask-ai", context, tEn)[0]!.route).toContain(
      encodeURIComponent("Which pets are overdue for vaccines?"),
    );
  });

  it("routes guide controls and entry points through the catalog", () => {
    const coachmark = readFileSync("components/tour/coachmark.tsx", "utf8");
    const settings = readFileSync(
      "app/(dashboard)/settings/page.tsx",
      "utf8",
    );
    const agent = readFileSync("app/(dashboard)/agent/page.tsx", "utf8");

    expect(coachmark).toContain('t("guides.coachmark.next")');
    expect(coachmark).toContain('t("guides.coachmark.finish")');
    expect(coachmark).toContain('t("guides.coachmark.skip")');
    expect(settings).toContain('t("guides.button")');
    expect(agent).toContain('t("guides.agent.emptyTitle")');
    expect(agent).toContain('t("guides.agent.send")');
    expect(agent).not.toContain("What can I help you with?");
  });
});
