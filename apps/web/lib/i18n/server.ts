import { resolveLanguage } from "./language";
import { createTranslator, type Translator } from "./messages";

/** Server-component and server-route translation entry point. */
export function getTranslations(language?: unknown): Translator {
  return createTranslator(resolveLanguage(language));
}
