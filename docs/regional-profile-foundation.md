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
