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

Persistence does not change billing, invoices, Spanish UI, fiscal integration,
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

## Regulatory enforcement

Regulatory runtime behavior is resolved from the authenticated practice's
persisted `regulatoryProfile`, never from a client payload or a country check.
The generic Settings update contract does not accept `regulatoryProfile`;
validated country transitions may assign their server-owned starting profile.
The central capability contract exposes separate gates for `US_DEA`, `UK_VMD`,
and shared foreign controlled-drug compliance notices.

- `US_DEA` preserves access to the existing DEA-scheduled controlled-substance
  ledger.
- `UK_VMD` identifies the UK capability independently. No operational VMD
  endpoints or reports currently exist in the application.
- `CR_NEUTRAL` keeps the clinical core available but disables DEA/VMD features
  and foreign controlled-drug compliance notices.
- `UNSPECIFIED` is conservative and has the same disabled foreign capabilities
  until an administrator selects an explicit profile.

Every DEA ledger query and mutation is gated server-side after resolving the
profile from the authenticated `practiceId`. The sidebar and direct route use
the same tenant-derived capability response. General prescriptions, refills,
medication history, inventory, and clinical dispensing remain available; only
the separate foreign-compliance notices are hidden for neutral profiles.

`CR_NEUTRAL` means a neutral clinical profile without foreign regulatory
enforcement. It is not a certification of, or claim of compliance with, Costa
Rican law. No SENASA, professional-college, Ministry of Health, MAG,
psychotropic, narcotic, prescription, or retention rules are implemented here.

Still pending: Spanish runtime UI, a separately researched and validated Costa
Rica regulatory profile, historical invoice currency, complete Costa Rica
phone/SMS support, fiscal connectors, and Doctor Pet branding.

`formatCurrency` now maps country `CR` to `es-CR`, so CRC formatting uses the
existing native `Intl.NumberFormat` strategy without hardcoding the symbol in
application screens. Costa Rica, CRC, and `America/Costa_Rica` are active in
registration, onboarding, and Practice Info.
