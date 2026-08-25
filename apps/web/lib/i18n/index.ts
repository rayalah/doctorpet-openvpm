export {
  PLATFORM_FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  resolveAuthenticatedPracticeLanguage,
  resolveLanguage,
  resolvePreAuthLanguage,
  resolvePublicTenantLanguage,
  type LanguagePreference,
  type SupportedLanguage,
} from "./language";
export { getTranslations } from "./server";
export { type TranslationKey, type Translator } from "./messages";
