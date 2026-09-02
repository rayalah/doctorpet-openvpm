import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n/messages";

describe("reminders and messaging i18n", () => {
  it("provides Spanish copy for the reminder and messaging surfaces", () => {
    expect(translate("es", "reminders.title")).toBe("Recordatorios de cuidado");
    expect(translate("es", "recalls.title")).toBe("Recordatorios de vacunación");
    expect(translate("es", "messaging.inbox")).toBe("Bandeja de entrada");
    expect(translate("es", "messaging.send")).toBe("Enviar");
    expect(translate("es", "messaging.statusReadByClient")).toBe(
      "Leído por el tutor",
    );
    expect(translate("es", "messaging.portalDescription")).not.toMatch(
      /Send questions/,
    );
  });

  it("keeps the canonical English fallback available", () => {
    expect(translate("en", "reminders.title")).toBe("Care reminders");
    expect(translate("en", "messaging.statusDelivered")).toBe("Delivered");
    expect(translate("es", "messaging.notStarted")).toBe("Sin iniciar");
    expect(translate("es", "messaging.notARealKey")).toBe(
      "messaging.notARealKey",
    );
  });

  it("localizes reminder errors without changing their server codes", () => {
    expect(translate("es", "reminders.changedError")).toBe(
      "Este recordatorio cambió. Actualizá la página antes de modificarlo.",
    );
    expect(translate("en", "reminders.changedError")).toBe(
      "This reminder changed. Refresh before updating it.",
    );
    expect(translate("es", "reminders.notFoundError")).toBe(
      "No se encontró el recordatorio de cuidado.",
    );
    expect(translate("es", "reminders.permissionError")).toBe(
      "No tenés permiso para actualizar recordatorios de cuidado.",
    );
  });

  it("covers the localized SMS summary and setup copy in both languages", () => {
    const keys = [
      "messaging.smsSummary.readyTitle",
      "messaging.smsSummary.notConfiguredDescription",
      "messaging.smsSummary.actionRequiredBadge",
      "messaging.smsSummary.pendingTitle",
      "messaging.smsSummary.disabledSendingDescription",
      "messaging.providerSafetyDescription",
      "messaging.completeRegistrationHosted",
      "messaging.today",
      "messaging.perMonth",
    ] as const;

    for (const key of keys) {
      expect(translate("en", key)).not.toBe(key);
      expect(translate("es", key)).not.toBe(key);
    }

    expect(translate("es", "messaging.smsSummary.readyTitle")).toBe(
      "La mensajería está lista",
    );
    expect(translate("en", "messaging.smsSummary.readyTitle")).toBe(
      "Texting is ready",
    );
  });
});
