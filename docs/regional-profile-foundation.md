# Regional profile foundation

`PracticeRegionalProfile` is a typed, pure foundation for future regional
configuration. It keeps these dimensions independent:

- country code;
- language;
- presentation locale;
- currency code;
- IANA timezone;
- regulatory profile;
- fiscal provider.

The profile is persisted on `practices` as `language`, `format_locale`,
`regulatory_profile`, and `fiscal_provider`; existing `country`, `currency`,
and `timezone` remain the single source for their dimensions. The settings
contract permits validated administrative reads/writes under the existing
tenant scope, and registration initializes legacy-compatible values.

Persistence does not adopt any runtime behavior: it does not change forms,
billing, invoices, active regulatory behavior, Spanish UI, fiscal integration,
or phone normalization. The central persisted-profile builder returns `null`
for unknown countries instead of inferring `US_DEA`; the migration records
such legacy rows as `UNSPECIFIED`. A conceptual rollback is to deploy code
that ignores these columns, then remove the four columns and constraints only
through a separately reviewed migration after verifying no deployment still
depends on them.

Country defaults are only starting profiles. Unknown countries return no
profile and never receive an implicit US DEA fallback. Costa Rica is active in
practice registration, onboarding, and Practice Info (`CR`, `es`, `es-CR`,
`crc`, `America/Costa_Rica`, `CR_NEUTRAL`, `none`).

The regional catalog now also exposes structural metadata for Costa Rica:

- country name: `Costa Rica`;
- currency: `CRC`, `Colón costarricense`, `₡`;
- timezone: `America/Costa_Rica`;
- phone country code: `+506`.

Selecting CR proposes the regional profile and uses the central catalog for
CRC and `America/Costa_Rica`. No Costa Rica tax rate is assumed: registration,
onboarding, and a country transition require an administrator to provide an
explicit rate. Existing clinics are not silently reinterpreted, prices and
historical invoices are not converted, and no fiscal compliance claim is made.

Still pending: Spanish runtime UI, functional `CR_NEUTRAL` regulation,
historical invoice currency, complete Costa Rica phone/SMS support, fiscal
connectors, and Doctor Pet branding.

`formatCurrency` now maps country `CR` to `es-CR`, so CRC formatting uses the
existing native `Intl.NumberFormat` strategy without hardcoding the symbol in
application screens. The active country list and UI timezone/currency lists
remain unchanged until a later adoption task.
