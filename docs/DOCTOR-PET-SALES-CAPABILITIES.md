# Doctor Pet — capacidades para conversación comercial

Documento de apoyo comercial basado únicamente en capacidades verificadas.
No usar frases como “único en el mercado”, “sin configuración” o “reemplaza
cualquier PIMS”.

## Resumen de valor

Doctor Pet concentra el día de una clínica veterinaria en un flujo conectado:
agenda, tutor, mascota, expediente, consulta, cargos, factura, inventario y
portal. La propuesta de valor comprobable es reducir cambios de sistema,
duplicación de registro y pérdida de contexto, manteniendo los datos de la
clínica exportables y el acceso controlado por práctica.

## Capacidades y demostración

| Problema | Función verificable | Resultado que se puede demostrar | Objeción / límite |
|---|---|---|---|
| El equipo salta entre agenda y expediente | Visit Workspace | Una consulta pasa de llegada a documentación, entrega y cierre | Requiere conexión; no es charting offline |
| El historial está fragmentado | Expediente longitudinal | SOAP, vacunas, recetas, labs, procedimientos, vitales y problemas en una vista | Profundidad de módulos externos aún varía |
| Se pierden cargos al cerrar la visita | Reconciliación de visita | El sistema exige resolver cargos, entrega y follow-up antes del cierre | Debe configurarse el flujo de la clínica |
| Los tutores llaman por información básica | Portal privado | Mascotas, vacunas, citas, mensajes y facturas accesibles por enlace | Pago online requiere Stripe Connect |
| Las citas llegan sin control | Booking público revisable | El tutor solicita; el personal confirma el horario | No es reserva instantánea irrestricta |
| El inventario no refleja el consumo | Stock y deducción | Lotes, vencimientos y productos dispensados producen cargos/ajustes trazables | No es ERP ni compra electrónica a distribuidores |
| Migrar da miedo | Importación con dry run | Se revisan filas agregadas, duplicadas, omitidas o rechazadas antes de guardar | Citas/facturas/attachments requieren alcance asistido |
| El software queda aislado | REST API y webhooks | Integradores leen/escriben recursos soportados y reciben eventos firmados | API pública es menor que tRPC interna |
| El personal necesita respuestas rápidas | Agent con herramientas | Consulta historial, vacunas, follow-up y agenda con revisión humana | Requiere modelo y no decide clínicamente |
| La clínica quiere conservar sus datos | Export, backup y restore | CSV y backup JSON documentados, con recuperación operativa | La operación del backup debe validarse en cada despliegue |

## Guion de demo recomendado

1. Crear tutor y mascota.
2. Agendar una cita desde la agenda.
3. Hacer check-in y abrir Visit Workspace.
4. Registrar una nota SOAP, un vital y una vacuna de ejemplo.
5. Añadir un servicio/producto, cerrar la entrega y generar factura.
6. Mostrar el saldo y el registro de inventario.
7. Abrir el portal del tutor y mostrar la información disponible.
8. Ejecutar una consulta del Agent en modo lectura.
9. Mostrar exportación y la frontera de configuración.

La demo debe usar datos sintéticos o autorizados y no debe insinuar que un
proveedor externo ya está conectado si no se verificó.

## Qué se puede afirmar

- Gestión conectada de una clínica veterinaria general.
- Expediente estructurado y flujo SOAP.
- Agenda y solicitudes de cita revisables.
- Facturación manual, estimados, pagos y ajustes.
- Inventario con lotes, vencimientos, proveedores y deducción.
- Portal del tutor y comunicaciones con servicios configurados.
- API REST, webhooks firmados, exportación y backup.
- Agent con revisión humana y escrituras protegidas.
- Arquitectura de práctica compartida, no forks por país o clínica.

## Qué debe decirse con precisión

- Email, SMS, pagos online, Agent y almacenamiento externo necesitan
  configuración y, en algunos casos, proveedor.
- Lab orders/result matching, e-prescribing, DICOM, contabilidad y otros
  conectores no están disponibles como estándar general.
- Offline, rebaño/grupo, reporting regulatorio automático y multiubicación
  productiva no deben venderse como disponibles.
- Las reglas fiscales, regulatorias y los valores configurables pertenecen a
  la operación de la práctica; cambiar idioma no los crea.

## Preguntas de calificación

- ¿La clínica puede trabajar con conexión confiable?
- ¿Es una práctica de animales de compañía o visitas a domicilio?
- ¿Qué debe migrarse y qué exportación puede proporcionar?
- ¿Necesita citas/facturas históricas o solo clientes, mascotas y clínica?
- ¿Quiere portal, email, SMS o pagos online? ¿Tiene esos proveedores listos?
- ¿Necesita herd/group medicine, reporting regulatorio, e-prescribing o lab
  directo? Si sí, se debe tratar como gap o proyecto separado.
- ¿Quién será dueño de la validación y del rollback?

## Evidencia técnica

La trazabilidad completa está en `docs/DOCTOR-PET-CAPABILITIES.md`. Las fuentes
principales son `apps/web/app`, `apps/web/server/routers`, `packages/db/schema`,
`packages/email`, `docs/clinic-pilot-readiness.md`,
`docs/clinic-pilot-operations.md`, `docs/api/README.md` y `ROADMAP.md`.
