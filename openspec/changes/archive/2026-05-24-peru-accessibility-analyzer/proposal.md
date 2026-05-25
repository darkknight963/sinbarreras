## Why

Existe una necesidad urgente y legal de asegurar la accesibilidad web en Perú, impulsada por la Resolución de Secretaría de Gobierno y Transformación Digital N° 001-2025-PCM/SGTD. Esta herramienta resolverá la necesidad de entidades públicas y privadas de auditar y cumplir estrictamente los 83 criterios WCAG 2.2 y postular al Sello de Accesibilidad Digital, utilizando una arquitectura de grado empresarial y alto rendimiento.

## What Changes

- Creación de un sistema distribuido con arquitectura de microservicios (NestJS API, Node Workers, Nginx/React) para escaneo masivo sin degradación de rendimiento.
- Incorporación de una capa de **evaluación semiautomática** donde los humanos asisten a los motores para verificar criterios como Lengua de Señas o claridad de texto.
- Implementación de almacenamiento de objetos (MinIO) para guardar eficientemente capturas de pantalla de errores sin saturar bases de datos.
- Soporte para auditar intranets gubernamentales usando "Scripts de Pre-Navegación" (flujos de login automáticos).
- Integración de cálculo automático del Valor de Priorización (Vp) con soporte de carga de métricas (Vo) en lote.

## Capabilities

### New Capabilities
- `accessibility-scanner`: Worker independiente de Node.js con Playwright, axe-core y Pa11y. Soporta flujos de pre-navegación para sitios con autenticación.
- `web-dashboard`: Interfaz SPA en React servida por Nginx. Permite evaluación semiautomática (flujo auditor humano), filtrado avanzado y visualización de progreso en tiempo real vía WebSockets.
- `core-api`: Backend en NestJS responsable de la orquestación, integración con BullMQ, PostgreSQL y MinIO.
- `report-generator`: Servicio para generar reportes en PDF (Ejecutivo, Técnico), Excel y JSON.
- `peruvian-compliance-module`: Módulo de evaluación para Sello de Accesibilidad Digital y cálculo masivo de Vp.

### Modified Capabilities

## Impact

- La arquitectura distribuida permite análisis masivos en paralelo escalando únicamente el contenedor "Worker", optimizando los recursos del servidor.
- Garantiza la retención a largo plazo de evidencias (capturas) gracias a MinIO, clave para auditorías de cumplimiento legal.
- Permite a las entidades auditar aplicaciones web internas (intranets) fundamentales para el Gobierno Digital.
