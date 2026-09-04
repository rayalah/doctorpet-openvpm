import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("demo conversion bridge UI", () => {
  const login = readFileSync("app/(auth)/login/page.tsx", "utf8");
  const demoAccessRoute = readFileSync("app/api/demo-access/route.ts", "utf8");
  const register = readFileSync("app/(auth)/register/page.tsx", "utf8");
  const firstDayRecommendations = readFileSync(
    "components/onboarding/first-day-recommendations.tsx",
    "utf8",
  );
  const layout = readFileSync("app/(dashboard)/layout.tsx", "utf8");
  const bar = readFileSync("components/demo/demo-conversion-bar.tsx", "utf8");
  const tracker = readFileSync(
    "components/demo/demo-funnel-tracker.tsx",
    "utf8",
  );

  it("instruments the email gate and start-clinic CTA", () => {
    expect(login).toContain("FUNNEL_EVENTS.demoLand");
    expect(login).toContain("FUNNEL_EVENTS.demoGateViewed");
    expect(login).toContain("anonymousId: visitorId ?? getFunnelVisitorId()");
    expect(login).not.toContain(
      "trackFunnelEvent(FUNNEL_EVENTS.demoGateSubmitted)",
    );
    expect(demoAccessRoute).toContain('name: "demo_gate_submitted"');
    expect(demoAccessRoute).toContain("await recordAcceptedDemoGate");
    expect(login).toContain("FUNNEL_EVENTS.demoCtaStartClinic");
    expect(login).toContain("buildCloudSignupUrl");
    expect(login).toContain('t("auth.login.demo.open")');
    expect(login).not.toContain("password123");
    expect(login).not.toContain("View raw credentials");
    expect(login.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(2);
    expect(login).toContain('t("auth.login.demo.startClinic")');
  });

  it("tracks signup land with acquisition context", () => {
    expect(register).toContain("FUNNEL_EVENTS.signupLand");
    expect(register).toContain("acquisition?.source");
    expect(register).toContain("acquisitionWithFunnelVisitorId");
    expect(register).toContain("getFunnelVisitorId()");
    expect(register).toContain("acquisition: registrationAcquisition");
  });

  it("reveals a useful first day before asking for account security", () => {
    expect(register).toContain('t("auth.register.profileTitle")');
    expect(register).toContain("<ClinicIntentBuilder");
    expect(register).toContain(
      'type RegistrationStage = "profile" | "workflow" | "preview" | "account"',
    );
    expect(register).toContain('t("auth.register.step")');
    expect(register).toContain('t("auth.register.stepOf")');
    expect(register).toContain('t("auth.register.workflowLegend")');
    expect(register).not.toContain(
      "Just your practice name and work email for now.",
    );
    expect(register).toContain('t("auth.register.practiceName")');
    expect(register).toContain('t("auth.register.workEmail")');
    expect(register).toContain('t("auth.register.showWorkflows")');
    expect(register).toContain('t("auth.register.previewTitle")');
    expect(register).toContain(
      "<FirstDayRecommendations primaryGoal={firstGoal} />",
    );
    expect(register).toContain('t("auth.register.secureWorkspace")');
    expect(register).toContain('t("auth.register.secureTitle")');
    expect(register.indexOf('t("auth.register.previewTitle")')).toBeLessThan(
      register.indexOf('t("auth.register.secureTitle")'),
    );
    expect(firstDayRecommendations).toContain("FIRST_GOAL_RECOMMENDATIONS");
    expect(firstDayRecommendations).toContain("onboarding.recommendations");
    expect(register).toContain('t("auth.register.password")');
    expect(register).not.toContain(
      "Two quick choices make the rest of setup feel like your clinic—not a generic software tour.",
    );
    expect(register).toContain("REGISTRATION_PROFILE_STORAGE_KEY");
    expect(register).toContain('setStage("workflow")');
    expect(register).toContain(
      "Practice name and email intentionally stay out of sessionStorage.",
    );
    expect(register).toContain("if (!profileRestored) return;");
    expect(register).toContain("setProfileRestored(true)");
    expect(register).toContain("onboardingDraft: { clinicModel, firstGoal }");
    expect(register).toContain("FUNNEL_EVENTS.signupProfileCompleted");
    expect(register).toContain("FUNNEL_EVENTS.signupSubmitted");
    expect(register).toContain("FUNNEL_EVENTS.signupSucceeded");
    expect(register).not.toContain(
      "No patient or client information belongs here.",
    );
  });

  it("mounts the demo bar and path tracker in the dashboard shell", () => {
    expect(layout).toContain("DemoConversionBar");
    expect(layout).toContain("DemoFunnelTracker");
    expect(bar).toContain('t("onboarding.demo.start")');
    expect(bar).toContain("buildCloudSignupUrl");
    expect(tracker).toContain("FUNNEL_EVENTS.demoToolOpened");
  });
});
