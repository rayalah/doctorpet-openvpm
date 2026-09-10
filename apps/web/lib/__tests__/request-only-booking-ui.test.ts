import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../i18n/messages";

describe("request-only booking UI", () => {
  const publicPage = readFileSync("app/book/[slug]/page.tsx", "utf8");
  const settingsTab = readFileSync(
    "components/settings/booking-tab.tsx",
    "utf8",
  );
  const portalPage = readFileSync("app/portal/[token]/book/page.tsx", "utf8");
  const activationChecklist = readFileSync(
    "components/dashboard/activation-checklist.tsx",
    "utf8",
  );
  const allSetStep = readFileSync(
    "components/onboarding/steps/all-set.tsx",
    "utf8",
  );
  const firstDayRecommendations = readFileSync(
    "components/onboarding/first-day-recommendations.tsx",
    "utf8",
  );

  it("describes every public submission as a request that the clinic confirms", () => {
    expect(publicPage).toContain('t("booking.public.title")');
    expect(publicPage).toContain('t("booking.public.success.title")');
    expect(publicPage).toContain('t("booking.public.request")');
    expect(publicPage).toContain('t("booking.public.description")');
    expect(translate("en", "booking.public.title")).toBe("Request an appointment");
    expect(translate("es", "booking.public.title")).toBe("Solicitá una cita");
    expect(publicPage).not.toContain("You're booked!");
    expect(publicPage).not.toContain('"Book appointment"');
    expect(publicPage).not.toContain("`Book ${selectedType.name}`");
  });

  it("removes auto-confirm from settings and explains the staff handoff", () => {
    expect(settingsTab).toContain('t("booking.settings.title")');
    expect(settingsTab).toContain('t("booking.settings.reviewWarning")');
    expect(translate("en", "booking.settings.reviewWarning")).toContain("assigns a doctor and room");
    expect(translate("es", "booking.settings.reviewWarning")).toContain("veterinario y sala");
    expect(settingsTab).not.toContain("Confirm bookings automatically");
    expect(settingsTab).not.toContain("config.autoConfirm");
  });

  it("requires an explicitly selected requestable type on both public forms", () => {
    expect(publicPage).toContain("typeId &&");
    expect(publicPage).toContain(
      "{ enabled: !!slug && !!date && !!typeId && !!locationId }",
    );
    expect(publicPage).toContain('t("booking.public.selectType")');
    expect(publicPage).not.toContain("General visit");

    expect(portalPage).toContain("hasValidAppointmentType");
    expect(portalPage).toContain("appointmentTypes.length === 0");
    expect(portalPage).toContain("Appointment requests are unavailable");
    expect(portalPage).toContain("typeId,");
    expect(portalPage).not.toContain("General visit");
  });

  it("associates public form labels and exposes time choices as radios", () => {
    for (const field of [
      "typeFieldId",
      "locationFieldId",
      "dateFieldId",
      "firstNameFieldId",
      "lastNameFieldId",
      "emailFieldId",
      "phoneFieldId",
      "websiteFieldId",
      "petNameFieldId",
      "speciesFieldId",
      "reasonFieldId",
    ]) {
      expect(publicPage).toContain(`htmlFor={${field}}`);
      expect(publicPage).toContain(`id={${field}}`);
    }
    expect(publicPage).toContain("<fieldset>");
    expect(publicPage).toContain("<legend");
    expect(publicPage).toContain('type="radio"');

    for (const field of [
      "patientFieldId",
      "typeFieldId",
      "locationFieldId",
      "dateFieldId",
      "timeFieldId",
      "reasonFieldId",
    ]) {
      expect(portalPage).toContain(`htmlFor={${field}}`);
      expect(portalPage).toContain(`id={${field}}`);
    }
  });

  it("shows an explicit unconfirmed request receipt", () => {
    expect(publicPage).toContain('t("booking.public.success.pending")');
    expect(portalPage).toContain("Requested — not yet confirmed");
    expect(publicPage).toContain('t("booking.public.success.preferredTime")');
    expect(portalPage).toContain("Preferred time");
  });

  it("associates booking settings labels with their controls", () => {
    for (const id of [
      "booking-page-slug",
      "booking-minimum-notice",
      "booking-window",
      "booking-welcome-message",
      "booking-accent-color",
    ]) {
      expect(settingsTab).toContain(`htmlFor="${id}"`);
      expect(settingsTab).toContain(`id="${id}"`);
    }
  });

  it("blocks misleading publication and explains how to resolve it", () => {
    expect(settingsTab).toContain("nextPublished && bookableSet.size === 0");
    expect(settingsTab).toContain('t("booking.settings.selectTypeBeforePublish")');
    expect(settingsTab).toContain('role="alert"');
  });

  it("fails closed until saved booking settings are available", () => {
    expect(settingsTab).toContain("pageSettingsUnavailable");
    expect(settingsTab).toContain('t("booking.settings.loadPageError")');
    expect(settingsTab).toContain('t("booking.settings.loadPageDescription")');
    expect(settingsTab).toContain("onClick={() => void myPage.refetch()}");
    expect(settingsTab).toContain('t("booking.settings.retrySettings")');
    expect(settingsTab).toContain("appointmentTypesUnavailable");
    expect(settingsTab).toContain('t("booking.settings.loadTypesError")');
    expect(settingsTab).toContain('t("booking.settings.loadTypesDescription")');
    expect(settingsTab).toContain("onClick={() => void types.refetch()}");
    expect(settingsTab).toContain('t("booking.settings.retryTypes")');
  });

  it("calls guided setup complete without claiming the clinic is ready to switch", () => {
    expect(activationChecklist).toContain("Guided setup checks complete");
    expect(activationChecklist).toContain("Configure appointment requests");
    expect(activationChecklist).toContain(
      "Choose which visit types and times clients can request, then publish the page.",
    );
    expect(activationChecklist).toContain(
      "Keep validating real clinic workflows with your team before",
    );
    expect(activationChecklist).not.toContain("is ready to run");
    expect(allSetStep).toContain("Add the first real client");
    expect(allSetStep).toContain(
      "Start with one real appointment, then decide what deserves a larger rollout.",
    );
    expect(allSetStep).toContain("FirstDayRecommendations");
    expect(firstDayRecommendations).not.toContain(
      "Here’s what I think will help first.",
    );
    expect(firstDayRecommendations).not.toContain(
      "Pick one useful win. The rest will still be here when you’re ready.",
    );
    expect(firstDayRecommendations).not.toContain(
      "Nothing here blocks launch.",
    );
    expect(firstDayRecommendations).toContain("Make getting paid easy");
    expect(firstDayRecommendations).toContain("Get paid faster");
    expect(firstDayRecommendations).not.toContain("Useful for every clinic");
    expect(firstDayRecommendations).toContain(
      "pay by card from their private link",
    );
    expect(firstDayRecommendations).not.toContain("ACH");
    expect(allSetStep).not.toContain("Your workspace is ready");
  });
});
