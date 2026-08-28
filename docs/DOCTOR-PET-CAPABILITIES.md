# DOCTOR PET APP — CATÁLOGO MAESTRO DE CAPACIDADES

Auditoría documental del repositorio actual. Fecha de corte: 2026-08-27.

## 1. Alcance y lectura correcta

Este documento describe lo que puede verificarse en el código, el esquema,
las rutas, los routers, las pruebas y la documentación del repositorio. No es
una promesa comercial ni sustituye la validación de una instalación concreta.

La clasificación usada en todo el catálogo es:

- **A — Implementada y expuesta:** existe flujo de producto verificable y una
  superficie de uso o API expuesta.
- **B — Implementada parcialmente:** existe una parte operativa, pero el flujo
  tiene límites funcionales o cobertura incompleta.
- **C — Backend existente / UI ausente o limitada:** hay persistencia o
  procedimientos verificables, pero no existe una superficie de uso completa.
- **D — Configurable o dependiente de proveedor:** el código existe, pero no se
  puede considerar operativo sin configuración, activación o proveedor externo.
- **E — No encontrada:** no se encontró una implementación utilizable en este
  repositorio.
- **F — Roadmap/futuro:** la documentación identifica explícitamente el trabajo
  como futuro, siguiente o posterior.

La clasificación es por capacidad; una nota de dependencia no convierte
automáticamente una capacidad A en D si su flujo principal funciona sin ella.

## 2. Estado auditado

- Repositorio auditado: `doctorpet-openvpm`.
- Rama: `feature/i18n-reports-documents-branding`.
- HEAD: `bdc45be` — `feat(i18n): localize billing and inventory`.
- Remoto observado: `origin/feature/i18n-billing-inventory` apunta al mismo
  commit que el HEAD observado.
- Working tree: contiene cambios locales no confirmados relacionados con la
  línea 8.7 (reportes, documentos PDF, branding, guías y pruebas). Fueron
  preservados y no forman parte de esta auditoría documental.
- Producción: no se modificó código, configuración, esquema ni datos.

## 3. Catálogo verificable

| # | Capacidad | Estado | Usuarios | Flujo real, datos y resultado | Superficie / evidencia | Límites y dependencias |
|---:|---|:---:|---|---|---|---|
| 1 | Autenticación y recuperación de cuenta | A | Todo el personal | Registro, verificación, invitación, inicio de sesión, recuperación y restablecimiento; sesiones persistidas. | Login y páginas de auth; `apps/web/server/routers/auth.ts`; `packages/db/schema/auth.ts`; pruebas `auth*.test.ts`. | Requiere correo configurado para entrega de mensajes. |
| 2 | Multi-tenancy y aislamiento por práctica | A | Todas las prácticas | Las lecturas y escrituras se acotan a `practiceId`; RLS y roles de base protegen filas de práctica. | Layout autenticado; `apps/web/server/trpc.ts`; `packages/db/schema/practices.ts`; `docs/security/row-level-security.md`. | La activación de RLS productiva requiere operación de despliegue. |
| 3 | Roles y permisos | A | Admin, veterinario, técnico, recepción, Viewer | Guards tRPC separan operaciones administrativas, clínicas, inventario y reportes. | `apps/web/server/guards.ts`; `apps/web/server/routers/*`; `packages/db/schema/users.ts`; `docs/security.md`. | El Viewer es de solo lectura; los límites dependen del procedimiento. |
| 4 | Configuración de práctica, ubicaciones y personal | A | Admin | Configura práctica, idioma, perfil regional, marca, ubicaciones, salas, usuarios, invitaciones y horarios. | Settings; `apps/web/server/routers/settings.ts`; `packages/db/schema/practices.ts`. | Una operación productiva multiubicación amplia no está validada como piloto. |
| 5 | Agenda día/semana | A | Recepción, técnicos, veterinarios, admins | Consulta, crea, reprograma, cancela y cambia estados de citas con vistas día/semana. | Schedule; `apps/web/app/(dashboard)/schedule/page.tsx`; `apps/web/server/routers/appointments.ts`; `packages/db/schema/scheduling.ts`. | La UX de arrastrar para reprogramar está marcada como trabajo futuro. |
| 6 | Tipos de cita, salas y configuración de agenda | A | Admin | Define duración, color, si requiere médico, salas y disponibilidad usada por agenda y booking. | Settings y agenda; `apps/web/server/routers/settings.ts`; `apps/web/server/routers/appointments.ts`. | Los nombres son configurables y no deben presentarse como enums traducibles. |
| 7 | Disponibilidad y conflictos | A | Recepción y equipo clínico | Calcula slots, valida solapamientos de médico y sala, y aplica horarios de proveedor. | Agenda y booking; `apps/web/lib/scheduling/availability.ts`; `apps/web/lib/scheduling/provider-availability.ts`; pruebas de seguridad y disponibilidad. | Requiere horarios y zona horaria correctamente configurados. |
| 8 | Ciclo de vida de la cita | A | Equipo de clínica | `scheduled`/`confirmed`/`checked_in`/`in_exam`/`checked_out`, cancelación y ausencias; estados internos permanecen estables. | Agenda, agenda pública y Visit Workspace; `packages/db/schema/scheduling.ts`; `apps/web/server/routers/appointments.ts`. | La traducción es solo de presentación. |
| 9 | Lista de espera | B | Recepción | Registra pacientes, estados y coincidencias para un slot disponible. | Router `apps/web/server/routers/waitlist.ts`; `packages/db/schema/scheduling.ts`; pruebas `waitlist-*`. | La experiencia completa en agenda todavía es limitada y el roadmap la enumera como siguiente trabajo. |
| 10 | Solicitud de cita pública | A | Tutor y recepción | Tutor solicita fecha, paciente, tipo, ubicación y motivo; la clínica revisa y acepta el horario final. | `apps/web/app/book/[slug]/page.tsx`; portal booking; `apps/web/server/routers/booking.ts` y `portal.ts`; pruebas `portal-booking-*`. | No es booking instantáneo irrestricto. |
| 11 | Clientes/tutores | A | Recepción y equipo clínico | Alta, edición, búsqueda, contacto, consentimiento SMS y relación con múltiples pacientes. | `apps/web/app/(dashboard)/clients`; `apps/web/server/routers/clients.ts`; `packages/db/schema/clients.ts`. | Importaciones grandes requieren dry run y revisión. |
| 12 | Historial de comunicaciones por tutor | A | Recepción y admins | Lista, asigna, marca leído, vincula y registra comunicaciones de teléfono, SMS, email y portal. | Inbox y detalle de cliente; `apps/web/server/routers/communications.ts`; `packages/db/schema/communications.ts`. | Entrega externa de email/SMS depende de proveedores. |
| 13 | Acceso de portal del tutor | A | Tutor y personal autorizado | Genera/rota enlace de acceso y expone una vista privada acotada a la práctica. | `apps/web/app/portal/[token]`; `apps/web/server/routers/portal.ts`; `apps/web/server/routers/clients.ts`. | El enlace es una credencial; debe compartirse por canal seguro. |
| 14 | Pacientes/mascotas | A | Recepción y equipo clínico | Alta, edición, especies, sexo, estado, peso, microchip, foto, alergias y tutor. | `apps/web/app/(dashboard)/patients`; `apps/web/server/routers/patients.ts`; `packages/db/schema/patients.ts`. | Campos clínicos introducidos por usuarios no se traducen dinámicamente. |
| 15 | Duplicados y merge de pacientes | A | Admin/equipo autorizado | Previsualiza colisiones y ejecuta merge transaccional conservando eventos y relaciones. | `patients/duplicates`; `apps/web/server/routers/patients.ts`; `packages/db/schema/patient-merge-events.ts`; pruebas de merge. | Operación de alto riesgo; requiere revisión humana. |
| 16 | Historial longitudinal del paciente | A | Equipo clínico | Consolida citas, SOAP, vacunas, laboratorios, procedimientos, vitales, problemas, recetas, cargos, archivos y consentimientos. | Detalle de paciente; `apps/web/server/routers/patients.ts`, `records.ts`; esquema clínico. | La profundidad de algunos módulos depende de su propia superficie. |
| 17 | Notas SOAP | A | Veterinario y equipo clínico | Crea borrador, guarda, finaliza y consulta Subjective/Objective/Assessment/Plan. | `records/new-soap/[patientId]`; `apps/web/server/routers/records.ts`; `packages/db/schema/clinical.ts`. | El contenido escrito por el usuario no se traduce. |
| 18 | Corrección, reemplazo y addendum SOAP | A | Veterinario/admin | Marca error, reemplaza nota según flujo controlado y agrega addenda con trazabilidad. | `records/replace-soap/[patientId]`, expediente; `packages/db/schema/soap-note-replacements.ts`; pruebas de correcciones. | Las notas históricas deben permanecer auditables e inmutables. |
| 19 | Alergias y corrección clínica | A | Equipo clínico | Registra alergeno, reacción y severidad; permite corrección con historial de quién y por qué. | Detalle de paciente; `apps/web/server/routers/patients.ts`, `records.ts`; `packages/db/schema/patients.ts`, `clinical-corrections.ts`. | No debe borrar silenciosamente evidencia clínica. |
| 20 | Vacunaciones | A | Equipo clínico | Registra vacuna, lote, fabricante, fecha y próxima fecha; consulta historial. | Expediente; `apps/web/server/routers/records.ts`; `packages/db/schema/clinical.ts`. | Recordatorios requieren política de notificación y entrega configurada. |
| 21 | Recall de vacunación | A | Admin y recepción | Detecta vencidas/próximas, previsualiza y envía recordatorios cuando la política lo permite. | Recalls y notifications; `apps/web/server/routers/notifications.ts`; `apps/web/app/api/cron/reminders/route.ts`; pruebas de recalls. | Email/SMS no se envían si el proveedor o consentimiento no cumplen. |
| 22 | Certificado de vacunación | A | Tutor y personal | Construye datos del certificado y genera/entrega documento descargable. | Portal y expediente; `apps/web/server/routers/portal.ts`; `apps/web/lib/pdf.ts`; pruebas `portal-vaccination-certificates-*`. | El PDF requiere revisión de idioma, marca y render visual por despliegue. |
| 23 | Prescripciones | A | Veterinario y equipo autorizado | Crea receta asociada a paciente, producto, dosis, frecuencia, duración y refills. | Expediente; `apps/web/server/routers/records.ts`; `packages/db/schema/prescriptions.ts`. | El nombre y la instrucción clínica son datos persistidos. |
| 24 | Ciclo de vida de recetas y refills | A | Veterinario, técnico, recepción | Revisa seguridad, autoriza refill, completa o cancela, registra eventos y expiración. | Componentes de prescriptions; `apps/web/lib/records/prescription-lifecycle.ts`; pruebas de lifecycle/safety. | La política clínica y permisos son obligatorios; no equivale a e-prescribing externo. |
| 25 | Cálculo de dosis | A | Veterinario | Calcula dosis ponderada con formulary y devuelve resultado para revisión. | `apps/web/server/routers/dosing.ts`; `apps/web/lib/records/dosing*`; pruebas de seguridad. | Es apoyo de cálculo, no decisión clínica autónoma. |
| 26 | Laboratorio manual en expediente | A | Equipo clínico | Registra resultados, unidades, rangos, flags, revisión y follow-up. | `apps/web/server/routers/records.ts`; `packages/db/schema/clinical.ts`, `lab-result-events.ts`; expediente. | El alcance es manual; no implica órdenes al laboratorio externo. |
| 27 | Bandeja y seguimiento de laboratorio | B | Equipo clínico | Lista resultados, asigna revisores/follow-up y completa estados de revisión. | `apps/web/app/(dashboard)/lab-results`; procedimientos `records.listLabReviewInbox`, `assignLabFollowUp`, `completeLabFollowUp`; `docs/lab-result-safety.md`. | La integración de órdenes/resultados IDEXX, Antech y Zoetis no está disponible de forma general. |
| 28 | Procedimientos | A | Equipo clínico | Registra procedimiento, fecha, notas y datos auxiliares dentro del expediente. | Expediente; `apps/web/server/routers/records.ts`; `packages/db/schema/clinical.ts`. | No incluye imagenología/DICOM. |
| 29 | Signos vitales | A | Equipo clínico | Registra y lista vitales por paciente o cita, con política de corrección. | `apps/web/components/records/encounter-vitals-card.tsx`; `apps/web/server/routers/vitals.ts`; `packages/db/schema/clinical.ts`. | La interpretación clínica sigue siendo responsabilidad profesional. |
| 30 | Planes de tratamiento | A | Veterinario y equipo | Crea plan ligado a problemas, actualiza estado de plan/ítems y muestra progreso. | `apps/web/server/routers/treatment-plans.ts`, `visit-treatment-plans.ts`; `apps/web/components/encounters/treatment-plan-composer.tsx`. | Cotización e impacto financiero requieren conciliación explícita. |
| 31 | Visit Workspace | A | Veterinario, técnico, recepción | Orquesta consulta, documentación, cargos, entrega, follow-up y estado de trabajo. | `encounters/[appointmentId]`; `apps/web/server/routers/encounters.ts`; `packages/db/schema/visit-work-items.ts`, `visit-closeouts.ts`. | Flujo conectado; no es charting offline. |
| 32 | Cierre clínico, entrega y reconciliación | A | Veterinario/admin | Verifica requisitos clínicos, prescripción, follow-up, disposición de cargos y handoff; completa visita. | Visit Workspace; `encounters.getVisitReconciliation`, `resolveVisitWork`, `completeVisit`; pruebas de closeout/reconciliation. | Se bloquea hasta resolver los gates; conserva evidencia de la decisión. |
| 33 | Facturación e invoice | A | Recepción, admin | Crea factura, agrega servicios/productos, calcula impuesto configurado, cambia estado y consulta saldo. | Billing y nueva factura; `apps/web/server/routers/billing.ts`; `packages/db/schema/billing.ts`. | Reglas fiscales locales no vienen implícitas en el idioma. |
| 34 | Estimados, plantillas y conversión a factura | A | Recepción y admin | Crea estimate, usa catálogo/plantillas, convierte a invoice y conserva líneas. | Billing; `apps/web/server/routers/templates.ts`, `billing.ts`; `packages/db/schema/templates.ts`, `billing.ts`. | Los servicios/productos y descripciones son configurables. |
| 35 | Pagos, ajustes, refunds y saldos | A | Admin/recepción | Registra pago manual, aplica crédito/write-off, reembolsa y consulta AR. | Billing; `billing.recordPayment`, `refundPayment`, `listAdjustments`, `applyInvoiceAdjustment`; pruebas de integridad. | Requiere controles operativos y no reemplaza conciliación contable externa. |
| 36 | Cobro online del tutor | D | Tutor, admin | Stripe Connect permite onboarding de la clínica y checkout de facturas del portal. | `apps/web/app/api/portal/checkout/route.ts`; `apps/web/server/routers/billing.ts`, `subscription.ts`; webhooks Stripe. | Requiere cuenta conectada, claves y configuración/validación de proveedor. |
| 37 | Catálogo de inventario | A | Admin y responsable de inventario | Crea/edita productos, categorías canónicas, precios, impuestos, lotes y existencias. | `apps/web/app/(dashboard)/inventory/page.tsx`; `apps/web/server/routers/inventory.ts`; `packages/db/schema/finance.ts` y schema asociado. | Categorías personalizadas se conservan; solo las canónicas tienen proyección visual. |
| 38 | Stock, lotes, vencimiento y deducción | A | Inventario y clínica | Ajusta stock, registra lote/vencimiento y descuenta productos al dispensar/cobrar. | Router `inventory.ts`, `billing.ts`; `packages/db/schema/dispense-charge-queue.ts`; pruebas `inventory-safety`, `stock-deduction`. | No es un ERP/distribuidor completo. |
| 39 | Proveedores | A | Responsable de inventario | Alta, edición y consulta de proveedores para reposición. | UI Inventario; `inventory.listSuppliers`, `createSupplier`, `updateSupplier`; esquema de inventario. | No se verificó compra electrónica con distribuidores. |
| 40 | Sustancias controladas | A | Veterinario/admin | Registra movimientos, lote, paciente, testigo, saldo y auditoría. | `controlled-substances`; `apps/web/server/routers/controlled-substances.ts`; `packages/db/schema/controlled-substances.ts`. | Validar procedimiento contra jurisdicción y política de la clínica. |
| 41 | Reportes operativos | A | Admin y dirección | Muestra ingresos, citas, servicios principales, utilización y alertas de inventario. | Reports; `apps/web/server/routers/reports.ts`; `apps/web/components/reports`; dashboard. | Interpretación y exportación deben validarse antes de uso financiero formal. |
| 42 | Exportación CSV/PDF de reportes | A | Admin | Genera exportaciones de resultados y documentos de apoyo. | `apps/web/lib/pdf.ts`; rutas y componentes de reports; pruebas `reports-export-ui` y `pdf-generation`. | La auditoría visual de PDF es necesaria para cada idioma y fuente. |
| 43 | Recordatorios y tareas de cuidado | A | Admin, recepción, clínicos | Crea/lista/completa reminders internos y ejecuta jobs de citas/vacunas. | `care-reminders`; `apps/web/server/routers/care-reminders.ts`, `notifications.ts`; cron reminders. | Insertar un reminder interno no envía por sí solo SMS/email. |
| 44 | Inbox de comunicaciones | A | Recepción y admins | Agrupa conversaciones, muestra no leídos, asigna y registra estado. | `inbox`; routers `communications.ts`, `messaging.ts`; pruebas de inbox/status. | La entrega real se separa de la proyección interna. |
| 45 | Email transaccional y reminders | D | Admin y tutores | Envía bienvenida, reset, recibos, reminders y preferencias/unsubscribe mediante proveedor. | `packages/email/src/templates`; `apps/web/server/routers/notifications.ts`; webhook Resend; `docs/hosted-cloud-production.md`. | Requiere Resend, dominio verificado y políticas anti-supresión. |
| 46 | SMS y texting bidireccional | D | Recepción y tutores | Registra consentimiento, activa proveedor, envía y reconcilia eventos inbound/outbound. | `apps/web/server/routers/messaging.ts`, `admin.ts`; cron SMS; schemas `messaging*`, `sms-*`. | Piloto controlado: carrier, registro, consentimiento, allowlist y activación son obligatorios. |
| 47 | Portal del tutor: mascotas, citas, mensajes, facturas | A | Tutor | Consulta mascotas, vacunas, citas, mensajes e invoices; solicita citas y puede pagar si está habilitado. | `apps/web/app/portal/[token]`; `apps/web/server/routers/portal.ts`; pruebas de portal. | Acceso mediante token y pago sujeto a Stripe Connect. |
| 48 | Onboarding, checklist y guías interactivas | A | Admin y personal nuevo | Configura práctica, equipo, datos, billing, agente, texting y tours guiados. | `onboarding`, `settings`; `apps/web/components/onboarding`, `tour`; `apps/web/server/routers/settings.ts`. | Los cambios locales no confirmados de 8.7 incluyen parte de la localización de guías. |
| 49 | Importación revisada de historial | A | Admin y operador de migración | Dry run, revisión y carga de clientes, pacientes, vacunas, SOAP, reminders y servicios; preserva identidad externa. | `migration-archive`, onboarding; `apps/web/server/routers/data.ts`, `migration-archive.ts`; `docs/migrating-to-openvpm.md`. | Invoices, appointments y attachments no están en el importer CSV autoservicio. |
| 50 | Exportación, backup y restore | A | Admin/operador | Exporta clientes, pacientes, citas, invoices y backup JSON; restaura en práctica nueva. | `apps/web/server/routers/data.ts`; cron backup; `docs/backup-restore-runbook.md`; help your-data. | Restore debe probarse en destino seguro; hosted backup depende de configuración. |
| 51 | Whiteboard de clínica | A | Todo el equipo | Muestra pacientes activos, ubicación/sala, médico, estado, hora y notas con refresh. | `whiteboard`; `apps/web/server/routers/whiteboard.ts`; `packages/db/schema/visit-work-items.ts`. | Es vista operativa, no sustituto del expediente. |
| 52 | Agent: consultas de práctica | A | Personal autorizado | Busca pacientes/clientes, resume historia, lista vacunas vencidas, follow-up y agenda. | Agent UI; `apps/web/server/routers/agent.ts`, `ai.ts`; `apps/web/app/api/v1/agent/route.ts`; `docs/help/ask-the-ai.md`. | Respuestas requieren revisión humana y modelo configurado. |
| 53 | Agent: acciones de escritura | D | Personal autorizado e integradores | Puede reservar citas o registrar datos con opt-in, scopes y trazas de tool calls. | `apps/web/server/routers/agent.ts`; API agent; pruebas `ai-safety`, `agent-rate-limit`. | Requiere proveedor/modelo y scopes; la escritura está deliberadamente bloqueada por defecto. |
| 54 | REST API v1 | A | Integradores | API-key scoped para clientes, pacientes, citas, SOAP y agent con contratos versionados. | `apps/web/app/api/v1`; `packages/api`; `docs/api/README.md`; pruebas `api-*`. | La cobertura REST es menor que la tRPC interna; no asumir paridad. |
| 55 | Webhooks firmados | A | Integradores | Suscripciones de eventos de cita, paciente, invoice y SOAP con HMAC y reintentos. | `apps/web/app/api/webhooks`; `apps/web/server/routers/webhooks.ts`; pruebas `webhook-*`. | Cada consumidor debe validar firma, reintentos e idempotencia. |
| 56 | Archivos, fotos y adjuntos | A | Personal y tutores según portal | Sube, sirve, replica y verifica archivos ligados a registros. | `apps/web/app/api/upload`, `files/[...path]`, `capture`; `apps/web/lib/upload-*`, storage; pruebas de límites/seguridad. | Requiere S3-compatible o MinIO y políticas de tamaño/seguridad. |
| 57 | Seguros y claims | C | Admin/equipo | Persistencia y procedimientos para pólizas, claims y estados. | `apps/web/server/routers/insurance.ts`; `packages/db/schema/insurance.ts`; pruebas `insurance-safety`. | No se encontró una superficie clínica completa de claims en las rutas auditadas. |
| 58 | Planes wellness y facturación recurrente | D | Admin y clientes | Define plan, enrola paciente, genera due invoices y marca cobro. | `apps/web/server/routers/wellness.ts`; `packages/db/schema/wellness.ts`; cron wellness-billing; UI settings. | Operación depende de configuración de billing y de la política de la práctica. |
| 59 | Documentos, consentimiento y firma | A | Personal y tutor | Solicita consentimiento, firma mediante enlace y consulta evidencia/archivos. | `apps/web/app/sign/[token]`, `capture/[token]`; `records` consent procedures; schemas `consents`, `files`. | Firma y documentos deben revisarse por jurisdicción y retención. |
| 60 | Perfil regional y neutralidad regulatoria | A | Admin | Separa idioma, locale de formato, país y capacidades regulatorias configurables. | `apps/web/lib/regional-profile.ts`; settings; `docs/I18N.md`, `docs/regional-profile-foundation.md`; prueba `cr-neutral-regulatory-ui`. | No proporciona por sí solo fiscalidad, reporting o prescripción nacional. |
| 61 | Calendario externo por feed | A | Personal | Genera feed de calendario y permite habilitar/rotar token. | `apps/web/app/api/calendar/[token]/route.ts`; `appointments.calendarFeed`; `docs/help/calendar-feed.md`. | Es feed de solo lectura; proteger y rotar el token. |
| 62 | Administración de plataforma y pilotos | C | Operador de plataforma | Observa activación, readiness, mensajería, billing y decisiones de piloto con evidencia separada. | `admin` router/page; `packages/db/schema/clinic-pilots.ts`; `docs/clinic-pilot-operations.md`. | No es una función de clínica ordinaria; requiere rol de plataforma y operación controlada. |

**Conteo auditado: 62 capacidades — A: 53, B: 2, C: 2, D: 5, E: 0, F: 0.**

Las capacidades explícitamente futuras y no contadas como implementadas son las
del apartado 8. El conteo no convierte rutas internas de soporte en producto
comercial para una clínica.

## 4. Circuitos E2E

### 4.1 Adquisición y activación — completo con dependencias

1. El visitante llega a la página pública/booking o al alta.
2. La práctica configura perfil, idioma, usuarios, tipos de cita y ubicación.
3. El tutor solicita una cita pública o el personal la crea.
4. Recepción revisa y confirma el horario.
5. La práctica puede continuar el onboarding con importación revisada.

Evidencia: `apps/web/app/book/[slug]/page.tsx`, `apps/web/server/routers/booking.ts`,
`apps/web/server/routers/settings.ts`, `apps/web/server/routers/data.ts`.

### 4.2 Consulta clínica — completo en modo conectado

1. Crear/verificar tutor y paciente.
2. Agendar y hacer check-in.
3. Abrir Visit Workspace.
4. Registrar vitales, SOAP, vacunas, receta, laboratorio manual, procedimiento
   y cargos según corresponda.
5. Finalizar documentación, resolver follow-up y entrega.
6. Cerrar administrativamente la visita.

Evidencia: `apps/web/server/routers/appointments.ts`, `encounters.ts`,
`records.ts`, `vitals.ts`, `visit-treatment-plans.ts`; `docs/clinic-pilot-operations.md`.

### 4.3 Financiero — completo para operación manual; online condicionado

1. Crear factura o convertir estimate.
2. Añadir líneas de servicios/productos y aplicar configuración fiscal.
3. Registrar pago, ajuste o refund.
4. Consultar saldo y estado.
5. Enviar invoice o habilitar checkout del tutor cuando Stripe Connect esté
   configurado.

Evidencia: `apps/web/server/routers/billing.ts`, `subscription.ts`,
`apps/web/app/api/portal/checkout/route.ts`, `packages/db/schema/billing.ts`.

### 4.4 Inventario — completo para catálogo y control clínico

1. Crear producto y proveedor.
2. Definir categoría canónica/personalizada, lote, vencimiento y stock.
3. Ajustar existencias.
4. Asociar producto a factura o dispensación.
5. Aplicar deducción y dejar cargo durable cuando corresponde.

Evidencia: `apps/web/server/routers/inventory.ts`, `billing.ts`,
`packages/db/schema/dispense-charge-queue.ts`.

### 4.5 Retención y comunicación — parcial por servicios externos

1. Crear recall/reminder o follow-up.
2. Previsualizar destinatarios y respetar consentimiento/preferencias.
3. Enviar email o SMS si el proveedor y la política están activos.
4. Recibir eventos, reconciliar estado y consultar inbox.

Evidencia: `apps/web/server/routers/notifications.ts`, `messaging.ts`,
`communications.ts`; cron routes; schemas `messaging*` y `sms-*`.

## 5. Capacidades diferenciadoras verificables

No se afirma exclusividad de mercado. Estas son diferencias comprobables en
este repositorio:

- un modelo de datos estructurado para clínica, billing, inventario,
  comunicaciones y migración, con aislamiento por práctica;
- API REST versionada y separada del contrato tRPC interno;
- webhooks firmados con reintentos e idempotencia documentados;
- Visit Workspace que exige reconciliar cierre clínico, cargos, entrega y
  follow-up;
- importación con dry run, identidad externa, deduplicación y archivo de
  migración;
- operación conectada con backup/export y restauración documentados;
- Agent con herramientas tipadas, scopes, opt-in para escrituras y revisión
  humana;
- separación explícita entre idioma, locale, país y capacidad regulatoria;
- seguimiento de eventos de alto riesgo clínico, financiero, SMS y migración.

## 6. Retención, crecimiento y configuración

### Implementado

- portal privado, solicitudes de cita y mensajes;
- recalls y recordatorios administrables;
- email transaccional cuando Resend está preparado;
- feed de calendario;
- wellness plans y generación de facturas recurrentes, sujetos a configuración;
- export/backup y evidencia de migración;
- funnels, activación y piloto controlado para operación de plataforma.

### Requiere configuración, aprobación o desarrollo adicional

- email: proveedor, dominio y supresión;
- SMS: carrier, registro, consentimiento y allowlist;
- pagos de tutores: Stripe Connect;
- IA: modelo/proveedor, revisión y permisos;
- migración grande o específica de proveedor: mapping, muestra, cutoff y
  transferencia segura;
- escalamiento productivo multiubicación: estructuras existen, operación no
  validada para venderla como estándar;
- campañas de marketing masivas: no forman parte del producto actual.

## 7. Gaps y exclusiones verificadas

### No disponibles para vender como estándar hoy

- charting offline: la aplicación protege trabajo no guardado, pero requiere
  conexión;
- medicina de rebaño/grupo y producción animal;
- reporting regulatorio automático;
- conexión directa general con IDEXX, Antech, Zoetis, Vetcove, Rhapsody,
  accounting sync o e-prescribing;
- importación CSV autoservicio de citas, invoices y attachments;
- producción multiubicación ampliamente validada.

### Futuros explícitos

`ROADMAP.md` identifica como trabajo futuro: drag-to-reschedule en el calendario,
lista de espera completa, herramientas de Agent más profundas con audit trail,
widget de booking embebible, integraciones de laboratorio, conectores de
compatibilidad PIMS, imagenología/DICOM, e-prescribing, terminales de pago,
operación multiubicación productiva, marketing masivo, estándar veterinario
inspirado en FHIR y aplicación móvil nativa.

### Fuera del producto o no encontrado como flujo utilizable

No se encontró una implementación utilizable de charting offline, medicina de
rebaño/grupo ni reporting regulatorio automático. Se mantienen como límites,
no como promesas de roadmap sin el respaldo indicado arriba.

## 8. Trazabilidad de UI, datos y operaciones

### Superficies App Router observadas

Auth, dashboard, admin, agent, billing, billing/new, care-reminders, clients,
patients, duplicates, encounters, inbox, inventory, lab-results,
migration-archive, onboarding, recalls, records, new-soap, replace-soap,
reports, schedule, settings y whiteboard; además booking público, portal,
capture, sign, legal, SMS y API docs.

### Fuentes de datos principales

`packages/db/schema/`: `auth`, `users`, `practices`, `clients`, `patients`,
`scheduling`, `clinical`, `prescriptions`, `billing`, `finance`, `communications`,
`messaging`, `consents`, `files`, `migrations`, `migration-records`,
`visit-closeouts`, `visit-work-items`, `wellness`, `controlled-substances`,
`clinic-pilots` y tablas de eventos/observabilidad.

### Integración interna

El mapa tRPC en `apps/web/server/routers/_app.ts` conecta auth, clients,
patients, appointments, records, billing, dashboard, whiteboard, reports,
portal, settings, communications, inventory, data, AI/Agent, webhooks,
notifications, encounters, templates, controlled substances, insurance,
API keys, dosing, vitals, treatment plans, wellness, waitlist, subscription,
messaging, booking, care reminders, migration archive y visit treatment plans.

## 9. Pruebas y criterio de confianza

La base contiene cobertura Vitest para UI, routers, seguridad, RLS, migraciones,
facturación, inventario, clinical records, SOAP, portal, API, webhooks,
reminders, SMS, email, storage y journeys E2E en `e2e/`. Esta tarea no ejecutó
suites de producción porque no modificó producción; la evidencia de capacidad es
estática y trazable. Las pruebas locales existentes pueden incluir cambios no
confirmados de la línea 8.7 y deben interpretarse junto con el diff de la rama.

## 10. Reconciliación y hallazgos

1. El código del repositorio conserva nombres técnicos OpenVPM/OpenPIMS en
   paquetes, rutas, documentación base, contratos API y licencia. Eso es una
   dependencia técnica/legal, no una capacidad comercial adicional.
2. `README.md` todavía describe varias superficies con la marca OpenVPM; la
   auditoría de producto debe separar marca comercial Doctor Pet de la base
   tecnológica y atribución AGPLv3.
3. La documentación de readiness es más conservadora que algunas listas de
   features: para venta debe prevalecer la frontera de `docs/clinic-pilot-readiness.md`.
4. tRPC cubre más procedimientos que la API pública; no debe prometerse paridad.
5. Los datos configurables —tipos de cita, nombres de productos, categorías
   personalizadas, ubicaciones y contenido clínico— se preservan literalmente;
   solo los enums/categorías canónicas tienen proyección visual.
6. La documentación actual mezcla OpenVPM y Doctor Pet en distintos lugares;
   esto es un hallazgo de branding/documentación, no un cambio de lógica.

## 11. Resultado de la auditoría

- **A. Rama / HEAD:** `feature/i18n-reports-documents-branding` / `bdc45be`.
- **B. Documentos creados:** este catálogo, `docs/DOCTOR-PET-NOTEBOOKLM-SOURCE.md`
  y `docs/DOCTOR-PET-SALES-CAPABILITIES.md`.
- **C. Total:** 62 capacidades.
- **D. Implementadas y expuestas:** 53.
- **E. Parciales:** 2.
- **F. Backend/UI limitado:** 2.
- **G. Configurables/dependientes:** 5.
- **H. No encontradas:** 0 dentro de las capacidades encontradas; los límites
  explícitos y ausencias se registran en gaps.
- **I. Circuitos E2E:** consulta y operación clínica completos en modo conectado;
  financiero manual e inventario completos; adquisición completa con revisión;
  retención parcial por proveedores.
- **J. Diferenciadores:** API separada, webhooks firmados, dry-run de migración,
  cierre de visita reconciliado, Agent con opt-in y separación regional.
- **K. Gaps:** offline, rebaño/grupo, reporting regulatorio automático,
  integraciones externas directas, multiubicación productiva y otros del roadmap.
- **L. Inconsistencias:** branding OpenVPM/Doctor Pet en documentación, tRPC más
  amplio que REST y límites de readiness más conservadores que el README.
- **M. `git diff --check`:** PASS después de crear estos documentos.
- **N. Cambios de producción:** ninguno; solo se crean documentos de auditoría.
- **O. NotebookLM:** **READY**, condicionado a que el lector use la sección de
  límites y no trate dependencias configurables como disponibilidad automática.
