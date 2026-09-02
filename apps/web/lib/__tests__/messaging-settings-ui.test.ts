import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isMessagingAreaCodeInputValid,
  isMessagingPhoneInputValid,
  MESSAGING_AREA_CODE_LENGTH,
  MESSAGING_PHONE_MAX_LENGTH,
  MESSAGING_PHONE_MIN_LENGTH,
  MESSAGING_SEARCH_LIMIT_MAX,
} from "../messaging/policy";

describe("messaging settings UI", () => {
  const tabSource = readFileSync(
    "components/settings/messaging-tab.tsx",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const wizardSource = readFileSync(
    "components/settings/messaging-wizard.tsx",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const registrationSource = readFileSync(
    "components/settings/messaging-registration-form.tsx",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const routerSource = readFileSync("server/routers/messaging.ts", "utf8").replace(/\r\n/g, "\n");
  const onboardingSource = readFileSync(
    "components/onboarding/steps/set-up-texting.tsx",
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("keeps messaging phone policy aligned across settings and router", () => {
    expect(MESSAGING_PHONE_MIN_LENGTH).toBe(7);
    expect(MESSAGING_PHONE_MAX_LENGTH).toBe(32);
    expect(MESSAGING_AREA_CODE_LENGTH).toBe(3);
    expect(MESSAGING_SEARCH_LIMIT_MAX).toBe(20);
    expect(isMessagingPhoneInputValid("(555) 555-0100")).toBe(true);
    expect(isMessagingPhoneInputValid("+1 555 555 0100")).toBe(true);
    expect(isMessagingPhoneInputValid("12345")).toBe(false);
    expect(isMessagingPhoneInputValid("1".repeat(33))).toBe(false);
    expect(isMessagingAreaCodeInputValid("")).toBe(true);
    expect(isMessagingAreaCodeInputValid("415")).toBe(true);
    expect(isMessagingAreaCodeInputValid("41")).toBe(false);
    expect(routerSource).toContain("MESSAGING_PHONE_MIN_LENGTH");
    expect(routerSource).toContain("MESSAGING_PHONE_MAX_LENGTH");
    expect(routerSource).toContain("MESSAGING_AREA_CODE_LENGTH");
    expect(routerSource).toContain("MESSAGING_SEARCH_LIMIT_MAX");
  });

  it("gates messaging setup and test-send controls before server rejection", () => {
    expect(tabSource).toContain("function hasConfiguredSender");
    expect(tabSource).toContain("messaging.senderE164?.trim()");
    expect(tabSource).toContain("messaging.messagingProfileId?.trim()");
    expect(tabSource).toContain("const canEnableSending =");
    expect(tabSource).toContain('m.registrationStatus === "active"');
    expect(tabSource).toContain("hasConfiguredSender(m)");
    expect(tabSource).toContain("m.launchEligible !== false");
    expect(tabSource).toContain("m.providerProfileAttestationFresh !== false");
    expect(tabSource).toContain("waitingForProviderVerification");
    expect(tabSource).toContain('t("messaging.safetyRequired")');
    expect(tabSource).toContain('t("messaging.providerSafetyDescription")');
    expect(routerSource).toContain(
      "providerProfileReady: locationMessaging.providerProfileReady",
    );
    expect(routerSource).toContain("providerProfileAttestationFresh:");
    expect(routerSource).toContain(
      "HOSTED_PROVIDER_PROFILE_ATTESTATION_MAX_AGE_MS",
    );
    expect(tabSource).toContain("testSendAllowed &&");
    expect(tabSource).toContain("isMessagingPhoneInputValid(testTo)");
    expect(tabSource).toContain("maxLength={MESSAGING_PHONE_MAX_LENGTH}");
    expect(tabSource).toContain(
      "disabled={setEnabled.isPending || (!m.enabled && !canEnableSending)}",
    );
    expect(tabSource).toContain(
      "disabled={!canSendTest || testSend.isPending}",
    );
    expect(tabSource).toContain("to: testTo.trim()");
    expect(tabSource).toContain('t("messaging.safelyOff")');
    expect(tabSource).toContain('t("messaging.arbitraryTestDisabled")');
    expect(tabSource).toContain("data.launch.setupAvailable");
    expect(tabSource).toContain('t("messaging.controlledPilot")');
    expect(tabSource).toContain('t("messaging.controlledPilotDescription")');
    expect(tabSource).toContain(
      "{data.launch.setupAvailable ? (\n        <MessagingWizard",
    );
    expect(tabSource).toContain(
      "{setupAvailable ? (\n          <Button onClick={onStartSetup}",
    );
    expect(wizardSource).toContain("MESSAGING_AREA_CODE_LENGTH");
    expect(wizardSource).toContain("isMessagingAreaCodeInputValid(areaCode)");
    expect(wizardSource).toContain(
      "disabled={checking || !isMessagingAreaCodeInputValid(areaCode)}",
    );
    expect(wizardSource).toContain(
      't("messaging.completeRegistrationHosted")',
    );
    expect(wizardSource).not.toContain("send a test from the active location");
    expect(tabSource).toContain("<MessagingRegistrationForm />");
    expect(tabSource).toContain(
      "data.launch.setupAvailable ||\n      locations.some((location) => location.messaging)",
    );
    expect(tabSource).toContain('t("messaging.setupDisabledAdmin")');
    expect(tabSource).toContain("hosted={data.launch.hosted}");
    expect(wizardSource).toContain("hosted: boolean");
    expect(wizardSource).toContain(
      "<ConfirmStep\n                hosted={hosted}",
    );
    expect(wizardSource).toContain('t("messaging.searchLocalNumber")');
    expect(wizardSource).toContain('t("messaging.adminFinishesActivation")');
    expect(wizardSource).toContain('t("messaging.completeRegistrationHosted")');
    expect(registrationSource).toContain('t("messaging.detailsSaved")');
    expect(registrationSource).toContain('t("messaging.registrationDescription")');
    expect(registrationSource).not.toContain("an OpenVPM operator reviews it");
    expect(tabSource).toContain('t("messaging.supportReviewFailed")');
    expect(routerSource).toContain(
      "!existing && !provisioningAvailableForPractice(ctx.practiceId)",
    );
    expect(wizardSource).not.toContain("trpc.messaging.testSend.useMutation");
    expect(wizardSource).not.toContain("isMessagingPhoneInputValid(testTo)");
    expect(wizardSource).not.toContain(
      "maxLength={MESSAGING_PHONE_MAX_LENGTH}",
    );
    expect(wizardSource).not.toContain("to: testTo.trim()");
    expect(wizardSource).not.toContain("Send test");
  });

  it("keeps automatic reminders explicit, constrained, and off by default", () => {
    expect(tabSource).toContain('t("messaging.automaticReminders")');
    expect(tabSource).toContain("APPOINTMENT_REMINDER_LEAD_OPTIONS");
    expect(tabSource).toContain("[24, 48, 72] as const");
    expect(tabSource).toContain("setAppointmentReminderSettings");
    expect(tabSource).toContain('t("messaging.remindersOff")');
    expect(tabSource).toContain("confirmReminderCatchUp");
    expect(tabSource).toContain('!confirmReminderCatchUp("expand", leadHours, t)');
    expect(tabSource).toContain('t("messaging.catchupWarning")');
    expect(routerSource).toContain("appointmentReminderLeadHoursInput");
    expect(routerSource).toContain("appointmentRemindersEnabled");
  });

  it("surfaces messaging status query failures and missing payloads before showing placeholder stats", () => {
    expect(tabSource).toContain("error, refetch");
    expect(tabSource).toContain("function MessagingLoadError");
    expect(tabSource).toContain("if (error)");
    expect(tabSource).toContain("if (!data)");
    expect(tabSource).toContain('t("messaging.loadError")');
    expect(tabSource).toContain('t("messaging.statusUnavailable")');
    expect(tabSource).toContain("onRetry={() => void refetch()}");
    expect(tabSource.indexOf("if (error)")).toBeLessThan(
      tabSource.indexOf("if (!data)"),
    );
    expect(tabSource.indexOf("if (!data)")).toBeLessThan(
      tabSource.indexOf("const usage = data.usage"),
    );
    expect(tabSource).toContain(
      "const locations = data.locations as MessagingSetupLocation[]",
    );
    expect(tabSource).not.toContain("data?.locations ?? []");
    expect(tabSource).not.toContain("const usage = data?.usage");
    expect(tabSource).not.toContain("const consent = data?.consent");
  });

  it("is explicit about unsupported existing numbers, charges, and recoverable setup", () => {
    expect(wizardSource).toContain(
      't("messaging.existingNumberUnavailable")',
    );
    expect(wizardSource).toContain('t("messaging.existingNumberUnchanged")');
    expect(wizardSource).toContain("chargeAcknowledged");
    expect(wizardSource).toContain('t("messaging.authorizeCharges")');
    expect(wizardSource).toContain("confirmProviderCharges: true");
    expect(wizardSource).toContain(
      '(step === "registration" &&\n      mode === "buy" &&\n      Boolean(selectedNumber) &&\n      chargeAcknowledged)',
    );
    expect(wizardSource).toContain("upfrontCost");
    expect(wizardSource).toContain("monthlyCost");
    expect(wizardSource).toContain("currency");
    expect(wizardSource).toContain('t("messaging.purchaseStartSetup")');
    expect(tabSource).toContain('t("messaging.reconcileSetup")');
    expect(tabSource).toContain('action: "resume"');
    expect(onboardingSource).not.toContain(
      "You can text from your existing number",
    );
    expect(onboardingSource).toContain('t("messaging.onboardingNumberAccepted")');
    expect(onboardingSource).toContain('t("messaging.onboardingRegistrationPending")');
    expect(onboardingSource).toContain('t("messaging.onboardingRegistrationApproved")');
    expect(onboardingSource).toContain('t("messaging.onboardingNumberSetupFailed")');
    expect(routerSource).toContain("pg_advisory_xact_lock");
    expect(routerSource).toContain("assertProvisioningEnabled();");
    expect(routerSource).toContain("confirmProviderCharges: z.literal(true)");
    expect(routerSource).toContain("findNumberOrdersByCustomerReference");
  });

  it("keeps unavailable texting setup out of the onboarding purchase flow", () => {
    expect(onboardingSource).toContain("status.data?.launch.setupAvailable");
    expect(onboardingSource).toContain(
      "const setupUnavailable = setupAvailable === false && !hasAnyNumber",
    );
    expect(onboardingSource).toContain('t("messaging.onboardingPilotTitle")');
    expect(onboardingSource).toContain('t("messaging.onboardingEmailAvailable")');
    expect(onboardingSource).toContain("const setupCapabilityKnown");
    expect(onboardingSource).toContain("{!setupCapabilityKnown ? (");
    expect(onboardingSource).toContain('t("messaging.onboardingOptional")');
    expect(onboardingSource).toContain('t("messaging.onboardingDisabledDeployment")');
    expect(onboardingSource).toContain('t("messaging.onboardingExistingReview")');
    expect(onboardingSource).toContain("setupDisabled && !messaging");
    expect(onboardingSource).toContain('href="/settings?tab=messaging"');
    expect(onboardingSource).toContain(
      "platformOperationalConfig.supportEmail",
    );
    expect(onboardingSource).toContain("setupAvailable === false || messaging");
    expect(onboardingSource).toContain(
      "{setupAvailable ? (\n        <MessagingWizard",
    );
  });
});
