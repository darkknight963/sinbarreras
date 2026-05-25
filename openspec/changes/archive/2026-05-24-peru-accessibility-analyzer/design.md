## Context

El proyecto requiere desarrollar un sistema avanzado y de grado empresarial para el análisis masivo de accesibilidad web, verificando el cumplimiento de los 83 criterios de la WCAG 2.2 y la normativa peruana (Resolución N° 001-2025-PCM/SGTD). Para soportar la carga pesada de ejecutar decenas de navegadores headless en paralelo sin bloquear la interfaz web, se requiere una arquitectura de microservicios o workers desacoplados. Todo estará empaquetado en contenedores Docker para un despliegue unificado.

## Goals / Non-Goals

**Goals:**
- Implementar una arquitectura desacoplada de alto rendimiento: API (NestJS), Frontend (Vite/React en Nginx) y Workers (Node.js/Playwright).
- Ejecutar escaneos masivos mediante colas de trabajo distribuidas con BullMQ y Redis.
- Almacenar de forma eficiente miles de capturas de pantalla y volcados HTML utilizando un servicio de almacenamiento de objetos (MinIO).
- Combinar escaneos automáticos (axe-core, pa11y) con flujos de evaluación semiautomática o manual asistida por humanos.
- Soportar auditorías en portales de la Administración Pública que requieren autenticación mediante "Scripts de Pre-Navegación".
- Automatizar el cálculo de Vp (Valor de Priorización) mediante cargas en bloque (CSV).
- Generar reportes técnicos, ejecutivos y legales en múltiples formatos.

**Non-Goals:**
- Corrección automática del código fuente de los sitios web analizados.
- Uso de tecnologías fuera del ecosistema TypeScript/Node.js para el backend (ej. Spring Boot) con el fin de mantener un único lenguaje y aprovechar la compatibilidad nativa de las herramientas de accesibilidad.

## Decisions

1. **Arquitectura Desacoplada (API vs Workers)**
   - *Rationale:* Separar el contenedor de la API (NestJS) de los contenedores Worker (Node.js + Chromium). Si los escaneos consumen el 100% de CPU/RAM del Worker, la API y el Dashboard seguirán siendo rápidos y responsivos. Permite escalabilidad horizontal.
2. **Backend en NestJS + TypeScript**
   - *Rationale:* NestJS ofrece una estructura empresarial, modular y orientada a objetos (similar a Spring Boot pero nativa en Node.js), perfecta para integrar WebSockets (progreso en tiempo real) y TypeORM.
3. **Almacenamiento Híbrido: PostgreSQL + MinIO**
   - *Rationale:* PostgreSQL (con JSONB) almacenará la data relacional y los árboles de errores complejos. MinIO (S3-compatible) almacenará las imágenes pesadas y HTML, evitando la saturación de la base de datos relacional.
4. **Motor de Análisis Dual y Asistido**
   - *Rationale:* Playwright + axe-core / Pa11y para automatización. Se integrará una capa de interfaz de usuario donde un experto puede marcar criterios manuales (ej. Lenguaje sencillo, Lengua de Señas) como "Aprobados/Fallidos", ya que los motores no pueden validar esto con precisión.
5. **Autenticación (Scripts de Pre-login)**
   - *Rationale:* Para auditar intranets, Playwright ejecutará secuencias inyectadas por el usuario (ej. escribir usuario, contraseña, clic) antes de analizar.

## Risks / Trade-offs

- **[Risk] Mayor complejidad de orquestación:** Tener 6 contenedores (Nginx, NestJS API, Node Worker, Postgres, Redis, MinIO) requiere más orquestación.
  - *Mitigación:* Entregar un archivo `docker-compose.yml` preconfigurado con redes internas cerradas y volúmenes persistentes listos para usar en un solo comando.
- **[Risk] Alto consumo de memoria por Chromium en el Worker:**
  - *Mitigación:* Configurar concurrencia estricta en BullMQ (ej. máximo 3 navegadores paralelos por contenedor Worker) y escalar horizontalmente añadiendo más contenedores Worker según la RAM del host.
