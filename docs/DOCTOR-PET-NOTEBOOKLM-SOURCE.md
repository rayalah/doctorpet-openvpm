# Doctor Pet — fuente de capacidades para NotebookLM

## Qué es este documento

Doctor Pet es una plataforma de gestión para clínicas veterinarias basada en
un código abierto de gestión de prácticas. Este resumen describe capacidades
que se pudieron verificar en el repositorio, sus límites y las dependencias
que una clínica debe revisar antes de usarla.

La plataforma cubre el trabajo diario de una clínica conectada: tutores,
mascotas, agenda, consulta, expediente, facturación, inventario, portal,
recordatorios, comunicaciones, reportes, exportación y una ayuda de IA. El
idioma de la interfaz, el formato regional, el país y las funciones
regulatorias se mantienen separados.

## Capacidades disponibles

### Acceso y organización

- Inicio de sesión, invitaciones, verificación y recuperación de cuenta.
- Prácticas separadas, roles de administrador, veterinario, técnico,
  recepción y solo lectura.
- Configuración de práctica, idioma, perfil regional, ubicaciones, salas,
  usuarios, horarios y tipos de cita.

### Agenda y llegada

- Calendario de día y semana.
- Citas, confirmaciones, reprogramación, cancelación, check-in, consulta,
  cierre y ausencia.
- Disponibilidad de médicos, salas y horarios.
- Solicitudes de cita desde página pública y portal. La clínica confirma el
  horario final; no es reserva instantánea sin revisión.
- Lista de espera con soporte funcional parcial.

### Tutores y mascotas

- Registro y búsqueda de tutores.
- Varias mascotas por tutor.
- Especie, sexo, estado, peso, microchip, fotos, alergias y duplicados.
- Revisión y combinación controlada de pacientes duplicados.
- Historial longitudinal de citas, notas, vacunas, recetas, laboratorios,
  procedimientos, vitales, problemas, archivos y datos financieros ligados.

### Expediente clínico

- Notas SOAP con borrador, finalización, corrección, reemplazo y addenda.
- Lista de problemas y alergias con trazabilidad.
- Vacunaciones, vencimientos, recordatorios y certificados.
- Prescripciones, revisión de seguridad, refills, finalización, cancelación y
  cálculo de dosis como apoyo profesional.
- Resultados manuales de laboratorio con unidades, rangos, flags, revisión y
  seguimiento.
- Procedimientos, signos vitales y planes de tratamiento.
- Visit Workspace para coordinar documentación, cargos, entrega, follow-up y
  cierre administrativo.

### Facturación e inventario

- Facturas, estimados, servicios, productos, impuestos configurados, estados,
  pagos manuales, ajustes, refunds y saldos.
- Plantillas de tratamientos y conversión de estimado a factura.
- Catálogo de productos, categorías, stock, lotes, vencimientos, proveedores
  y ajustes.
- Deducción de stock y cargos asociados a dispensación.
- Registro de sustancias controladas con paciente, lote, testigo y auditoría.

### Portal, comunicaciones y retención

- Portal privado para mascotas, vacunas, citas, mensajes y facturas.
- Solicitudes de cita y mensajes del tutor.
- Inbox de comunicaciones con llamadas, SMS, email y portal.
- Recordatorios de citas, vacunación y tareas internas.
- Feed de calendario para calendarios externos.
- Planes wellness y generación de facturas recurrentes, sujetos a configuración.

### Datos, documentos y extensibilidad

- Importación revisada con dry run de tutores, mascotas, vacunas, notas,
  recordatorios y servicios.
- Exportación CSV y backup JSON; restore documentado.
- Documentos, adjuntos, fotos, consentimiento y firma mediante enlace.
- Reportes de ingresos, citas, servicios y alertas de inventario; exportación
  CSV/PDF.
- API REST versionada para tutores, mascotas, citas, SOAP y Agent.
- Webhooks firmados para eventos de citas, pacientes, facturas y SOAP.
- Agent de consulta con herramientas estructuradas y escritura protegida por
  opt-in y permisos.
- Whiteboard operativo para pacientes en curso.

## Circuito principal de una consulta

1. Crear o verificar tutor y mascota.
2. Agendar y registrar llegada.
3. Abrir la consulta.
4. Documentar SOAP y añadir vitales, vacunas, receta, laboratorio,
   procedimiento o cargos cuando corresponda.
5. Resolver entrega, seguimiento y requisitos pendientes.
6. Cerrar la visita.
7. Facturar, registrar pago o documentar una excepción.
8. Entregar indicaciones al tutor y dejar trazabilidad.

El flujo está diseñado para clínicas conectadas. No debe venderse como
expediente offline.

## Qué requiere configuración

- Email: proveedor de envío y dominio verificado.
- SMS: carrier, registro, consentimiento, proveedor y activación controlada.
- Pago online del tutor: Stripe Connect de la clínica.
- Agent: modelo/proveedor, revisión del personal y permisos de escritura.
- Archivos: almacenamiento compatible con S3 o MinIO.
- Migraciones complejas: mapeo, muestra, dry run, reconciliación y transferencia
  segura.
- Planes recurrentes y servicios conectados: configuración financiera de la
  práctica.

## Límites actuales

- No hay charting offline.
- No está lista la medicina de rebaño/grupo.
- No hay reporting regulatorio automático general.
- Las integraciones directas de laboratorios, distribuidores, contabilidad,
  e-prescribing e imagenología no están disponibles como producto general.
- El importador CSV autoservicio no cubre directamente citas, facturas y
  attachments.
- La operación productiva multiubicación aún no está validada ampliamente.
- El SMS es un piloto controlado; las campañas masivas de marketing no forman
  parte del producto.

## Trabajo futuro explícito

El roadmap menciona drag-to-reschedule, una experiencia completa de lista de
espera, herramientas de IA más profundas con auditoría, widget de booking
embebible, integraciones de laboratorio, conectores de compatibilidad PIMS,
DICOM, e-prescribing, terminales de pago, multiubicación productiva, marketing
masivo, un estándar veterinario inspirado en FHIR y una aplicación móvil.

Estas ideas están separadas de las capacidades actuales y no deben describirse
como disponibles.

## Cómo interpretar los datos

Los nombres de mascotas, tutores, productos, ubicaciones, tipos de cita,
diagnósticos, notas y otras entradas configurables son datos de la clínica.
Doctor Pet puede traducir etiquetas de la interfaz, pero no debe cambiar
silenciosamente esos valores almacenados. Los estados internos y contratos de
integración también permanecen estables aunque se presenten en otro idioma.

## Conclusión

Doctor Pet está mejor posicionado para un piloto controlado de clínica general
de animales de compañía o visitas a domicilio con conexión confiable, un
responsable de la clínica, un campeón operativo y validación junto al sistema
anterior. El criterio de go-live debe incluir exactitud clínica, integridad de
facturación, aislamiento de datos, exportación, comunicación y un plan de
rollback.
