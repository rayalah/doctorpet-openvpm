# Doctor Pet i18n foundation

This foundation introduces a small typed message catalog for Doctor Pet without
changing routes, auth behavior, persistence, regulatory behavior, or formatting.
It supports `en` and `es`; English is the complete canonical catalog and the
platform fallback.

## Language resolution

The UI language is resolved only from the explicit persisted `language` field:

1. Authenticated practice surfaces use the practice's persisted language.
2. Public tenant surfaces use the tenant's persisted language.
3. Pre-auth and tenantless surfaces use the platform fallback (`en`).

Language is deliberately independent of `formatLocale`, country, currency,
timezone, browser preferences, and regulatory profile. For example, a Costa
Rica practice can retain English UI while using `es-CR` formatting.

The login page is a pre-auth route, so it does not have a trusted tenant
context. It therefore uses the explicit English platform fallback in this
increment. A future tenant-aware pre-auth entry point may supply an explicit
tenant language; it must not infer one from the browser or regional settings.

## APIs

- Server components and routes use `getTranslations(language)` from
  `@/lib/i18n/server`.
- Client components use `useTranslations()` from `@/lib/i18n/client`, inside
  `I18nProvider`.
- `resolveAuthenticatedPracticeLanguage`, `resolvePublicTenantLanguage`, and
  `resolvePreAuthLanguage` in `@/lib/i18n/language` are the only resolution
  entry points.

Message keys are semantic and domain-scoped, for example
`auth.login.submit` and `common.save`. Catalog domains are split under
`apps/web/lib/i18n/messages/`; do not place regulatory, fiscal, or business
rules in them.

## Fallback and migration rules

English must remain a complete catalog. If a translated key is temporarily
missing, rendering falls back to its English value. An unknown runtime key is
rendered as its identifier so it can be diagnosed rather than silently becoming
empty; typed callers cannot introduce such a key at compile time.

Use this foundation one user-facing surface at a time. Do not mass-translate
the app, infer language from `formatLocale`, create per-clinic forks, or add a
runtime i18n library without a focused decision and migration plan.

## Adding copy and languages

To add a translation, add the semantic key to the English domain catalog first,
then add its localized value to the matching language/domain catalog. Keep the
English catalog complete and add a focused test for the migrated surface.

To add a future language, extend `SUPPORTED_LANGUAGES`, add its domain
catalogs, and extend the persisted-language validation only in a dedicated
schema/persistence task. This foundation intentionally does not make that
persistence change.

## Surfaces not yet migrated

Login, the authenticated sidebar, top bar, dashboard page/charts, welcome
surface, tutor lists and core forms, patient lists and core forms, patient
general-detail labels, and the appointment agenda/core booking and detail
controls are migrated pilots. The authenticated shell receives language from
the existing protected `settings.getPractice` query, so it uses the active
practice's persisted language and never trusts a browser-supplied tenant value.

Registration, portal, emails, PDFs, SMS, API documentation, the deep clinical
record/SOAP/prescription/procedure/lab workflows, billing and checkout remain
unchanged and require separate, reviewable migrations. Existing formatting
helpers continue to own dates, currency, and time zones.

PDF invoice and discharge-instruction structural copy remains in English. The
separate CRC glyph/encoding issue (rendering `₡` as `¡` in some PDFs) is also
out of scope for this foundation and must be addressed as a focused PDF font
and encoding task.

## Future adoption order

1. Supply persisted practice language to authenticated layouts.
2. Supply explicit tenant language to public tenant routes.
3. Migrate coherent message domains with tests and Spanish veterinary
   terminology review.
4. Keep date, currency, and timezone work in their existing format helpers;
   translation changes must not alter formatting behavior.
