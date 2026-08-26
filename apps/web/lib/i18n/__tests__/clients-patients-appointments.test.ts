import { describe, expect, it } from "vitest";
import { resolveAuthenticatedPracticeLanguage } from "../language";
import { getTranslations } from "../server";
import { createTranslator } from "../messages";
import { patientStatusLabel, sexLabel, speciesLabel } from "../presentation-labels";

describe("clients, patients, and appointments localization", () => {
  it("provides Spanish operational copy", () => {
    const t = getTranslations("es");
    expect(t("clients.title")).toBe("Tutores");
    expect(t("patients.title")).toBe("Pacientes");
    expect(t("patients.tutor")).toBe("Tutor");
    expect(t("patients.capturePhotos")).toBe("Capturar fotos");
    expect(t("patients.getSignature")).toBe("Obtener firma");
    expect(t("clients.editAction")).toBe("Editar");
    expect(t("appointments.title")).toBe("Agenda");
    expect(t("appointments.new")).toBe("Nueva cita");
    expect(t("appointments.request.subject")).toBe("Solicitud de cita para");
    expect(t("clinicalRecords.title")).toBe("Expedientes clínicos");
    expect(t("clinicalRecords.tabs.soap")).toBe("Notas SOAP");
  });

  it("preserves the English catalog", () => {
    const t = getTranslations("en");
    expect(t("clients.title")).toBe("Clients");
    expect(t("clients.editAction")).toBe("Edit");
    expect(t("patients.new")).toBe("New Patient");
    expect(t("patients.capturePhotos")).toBe("Capture photos");
    expect(t("clinicalRecords.title")).toBe("Medical Records");
    expect(t("clinicalRecords.tabs.vaccinations")).toBe("Vaccinations");
    expect(t("appointments.status.confirmed")).toBe("Confirmed");
  });

  it("localizes presentation labels without changing their persisted enum values", () => {
    const t = createTranslator("es");
    expect(speciesLabel(t, "canine")).toBe("Canino");
    expect(sexLabel(t, "male_neutered")).toBe("Macho (castrado)");
    expect(patientStatusLabel(t, "deceased")).toBe("Fallecido");
    expect("canine").toBe("canine");
    expect("male_neutered").toBe("male_neutered");
    expect("checked_in").toBe("checked_in");
  });

  it("keeps language independent from regional formatting configuration", () => {
    expect(resolveAuthenticatedPracticeLanguage({ language: "es", formatLocale: "en-US", timezone: "America/Costa_Rica" } as never)).toBe("es");
    expect(resolveAuthenticatedPracticeLanguage({ language: "en", formatLocale: "es-CR", timezone: "America/Costa_Rica" } as never)).toBe("en");
  });
});
