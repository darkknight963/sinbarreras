# PROYECTO_ACCESIBILIDAD

Plataforma de analisis de accesibilidad web enfocada en WCAG 2.2 y criterios de cumplimiento peruano (Resolucion N. 001-2025-PCM/SGTD).

Incluye:
- `frontend`: Dashboard React + Vite
- `api`: Backend NestJS + TypeORM + BullMQ
- `worker`: Escaneo con Playwright + axe-core
- `postgres`: Base de datos
- `redis`: Cola de trabajos
- `minio`: Almacenamiento de evidencias (capturas/HTML)

## Requisitos

- Docker + Docker Compose
- Node.js 20+ (si ejecutas en local sin Docker)
- npm

## Estructura

```text
.
├─ api/
├─ worker/
├─ frontend/
├─ docker-compose.yml
└─ openspec/
```

## Arranque rapido (Docker)

Desde la raiz del proyecto:

```bash
docker compose up -d --build
```

administrador@sinbarreras.com
12345678

Servicios expuestos:
- Frontend: `http://localhost` (puerto 80)
- API: `http://localhost:3000`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

Para ver logs:

```bash
docker compose logs -f
```

Para detener:

```bash
docker compose down
```

Para detener y borrar volumenes:

```bash
docker compose down -v
```

## Variables de entorno

El `docker-compose.yml` ya trae valores por defecto:

- `DB_USER=postgres`
- `DB_PASSWORD=postgres`
- `DB_NAME=accessibility_db`
- `MINIO_ROOT_USER=admin`
- `MINIO_ROOT_PASSWORD=admin123`

Si deseas personalizar, crea un archivo `.env` en la raiz con esos valores.

## Culqi

El flujo de suscripciones usa:

- Culqi Checkout para capturar la tarjeta.
- Culqi Suscripciones para crear y mantener los cobros recurrentes.
- Culqi API para crear cliente, tarjeta y suscripción desde el backend.

Guía completa:
- [`docs/culqi-setup.md`](docs/culqi-setup.md)

Archivos de configuración:
- [`api/.env.example`](api/.env.example)
- [`frontend/.env.example`](frontend/.env.example)

## Ejecucion en local (sin Docker para app)

Recomendado mantener `postgres`, `redis` y `minio` en Docker y correr app local:

```bash
docker compose up -d postgres redis minio
```

### 1) API

```bash
cd api
npm install
npm run start:dev
```

### 2) Worker

```bash
cd worker
npm install
npm run dev
```

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend local normalmente en `http://localhost:5173`.

## Comandos utiles por servicio

### API (`api/package.json`)

```bash
npm run build
npm run start:dev
npm run test
npm run test:e2e
npm run lint
```

### Worker (`worker/package.json`)

```bash
npm run build
npm run dev
npm run start
```

### Frontend (`frontend/package.json`)

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Flujo basico de uso

1. Crear proyecto desde API.
2. Disparar escaneo con lista de URLs.
3. Worker procesa URLs y guarda resultados/evidencias.
4. Dashboard muestra avance en tiempo real via WebSocket.
5. Exportar reportes (JSON/Excel/PDF).

## Endpoints principales

Base URL API: `http://localhost:3000`

### Proyectos
- `GET /projects`
- `POST /projects`
- `GET /projects/:id`

### Scans
- `POST /scans`
- `GET /scans`
- `GET /scans/:id`

### Compliance
- `POST /compliance/bulk-vp`
- `POST /compliance/calculate-vp`
- `POST /compliance/check-domain`
- `GET /compliance/sign-language-checks`
- `GET /compliance/wcag-checklist`

### Reportes
- `GET /reports/:scanId/json`
- `GET /reports/:scanId/excel`
- `GET /reports/:scanId/pdf?type=executive`
- `GET /reports/:scanId/pdf?type=technical`

## OpenSpec

Specs consolidados:
- `openspec/specs/accessibility-scanner/spec.md`
- `openspec/specs/web-dashboard/spec.md`
- `openspec/specs/peruvian-compliance-module/spec.md`
- `openspec/specs/report-generator/spec.md`

Change archivado:
- `openspec/changes/archive/2026-05-24-peru-accessibility-analyzer/`

## Troubleshooting

- Si API no conecta a DB: revisa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`.
- Si Worker no procesa: valida conexion a Redis (`REDIS_HOST`, `REDIS_PORT`) y que API encole jobs.
- Si no aparecen capturas: revisa MinIO (`MINIO_*`) y acceso al bucket `accessibility-evidence`.
- Si hay puertos ocupados, cambia mapeos en `docker-compose.yml`.
