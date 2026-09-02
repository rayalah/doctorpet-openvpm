import type { SupportedLanguage } from "./language";
import { enAuthMessages, esAuthMessages } from "./messages/auth";
import { enCommonMessages, esCommonMessages } from "./messages/common";
import { enDashboardMessages, esDashboardMessages } from "./messages/dashboard";
import { enNavigationMessages, esNavigationMessages } from "./messages/navigation";
import { enWelcomeMessages, esWelcomeMessages } from "./messages/welcome";
import { enClientMessages, esClientMessages } from "./messages/clients";
import { enPatientMessages, esPatientMessages } from "./messages/patients";
import { enAppointmentMessages, esAppointmentMessages } from "./messages/appointments";
import { enClinicalRecordMessages, esClinicalRecordMessages } from "./messages/clinical-records";
import { enVisitWorkspaceMessages, esVisitWorkspaceMessages } from "./messages/visit-workspace";
import { enBillingMessages, esBillingMessages } from "./messages/billing";
import { enInventoryMessages, esInventoryMessages } from "./messages/inventory";
import { enReportsMessages, esReportsMessages } from "./messages/reports";
import { enDocumentMessages, esDocumentMessages } from "./messages/documents";
import { enPdfMessages, esPdfMessages } from "./messages/pdf";
import { enBrandingMessages, esBrandingMessages } from "./messages/branding";
import { enGuidesMessages, esGuidesMessages } from "./messages/guides";
import { enReminderMessages, esReminderMessages } from "./messages/reminders";
import { enMessagingMessages, esMessagingMessages } from "./messages/messaging";

export const enMessages = {
  ...enCommonMessages,
  ...enAuthMessages,
  ...enNavigationMessages,
  ...enDashboardMessages,
  ...enWelcomeMessages,
  ...enClientMessages,
  ...enPatientMessages,
  ...enAppointmentMessages,
  ...enClinicalRecordMessages,
  ...enVisitWorkspaceMessages,
  ...enBillingMessages,
  ...enInventoryMessages,
  ...enReportsMessages,
  ...enDocumentMessages,
  ...enPdfMessages,
  ...enBrandingMessages,
  ...enGuidesMessages,
  ...enReminderMessages,
  ...enMessagingMessages,
} as const;

export type TranslationKey = keyof typeof enMessages;

type LocalizedMessages = Partial<Record<TranslationKey, string>>;

const messages: Record<SupportedLanguage, LocalizedMessages> = {
  en: enMessages,
  es: {
    ...esCommonMessages,
    ...esAuthMessages,
    ...esNavigationMessages,
    ...esDashboardMessages,
    ...esWelcomeMessages,
    ...esClientMessages,
    ...esPatientMessages,
    ...esAppointmentMessages,
    ...esClinicalRecordMessages,
    ...esVisitWorkspaceMessages,
    ...esBillingMessages,
    ...esInventoryMessages,
    ...esReportsMessages,
    ...esDocumentMessages,
    ...esPdfMessages,
    ...esBrandingMessages,
    ...esGuidesMessages,
    ...esReminderMessages,
    ...esMessagingMessages,
  },
};

/**
 * English is the complete canonical catalog. A missing localized entry falls
 * back to English; an unknown key is returned as its identifier for diagnosable
 * safe rendering instead of producing an empty user-facing string.
 */
export function translate(language: SupportedLanguage, key: string): string {
  const localized = messages[language][key as TranslationKey];
  if (localized) return localized;

  return enMessages[key as TranslationKey] ?? key;
}

export type Translator = (key: TranslationKey) => string;

export function createTranslator(language: SupportedLanguage): Translator {
  return (key) => translate(language, key);
}
