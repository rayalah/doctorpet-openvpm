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

The module deliberately is not connected to persistence, forms, routers,
billing, or active regulatory behavior. Existing practices therefore retain
their current behavior until a later task adopts individual dimensions.

Country defaults are only starting profiles. Unknown countries return no
profile and never receive an implicit US DEA fallback. Costa Rica is present
only as a conceptual profile (`CR`, `es`, `es-CR`, `crc`,
`America/Costa_Rica`, `CR_NEUTRAL`, `none`); it is not selectable yet.

The regional catalog now also exposes structural metadata for Costa Rica:

- country name: `Costa Rica`;
- currency: `CRC`, `Colón costarricense`, `₡`;
- timezone: `America/Costa_Rica`;
- phone country code: `+506`.

This is structural support only. It does not activate CR in registration or
settings forms, persist new regional dimensions, change regulation, enable
Spanish UI, modify billing or invoices, implement fiscal integration, or
change phone normalization for national numbers without an explicit prefix.

`formatCurrency` now maps country `CR` to `es-CR`, so CRC formatting uses the
existing native `Intl.NumberFormat` strategy without hardcoding the symbol in
application screens. The active country list and UI timezone/currency lists
remain unchanged until a later adoption task.
