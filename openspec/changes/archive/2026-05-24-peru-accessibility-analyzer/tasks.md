## 1. Project Setup & Architecture

- [x] 1.1 Setup Docker Compose with 6 services: frontend, api, worker, postgres, redis, minio
- [x] 1.2 Initialize core-api using NestJS, configure TypeORM/PostgreSQL and BullMQ producer
- [x] 1.3 Initialize worker node (Node.js) listening to Redis BullMQ, configuring Playwright
- [x] 1.4 Setup React SPA frontend with Vite and TailwindCSS
- [x] 1.5 Configure MinIO bucket policies and API integration for object storage

## 2. Core Scanning Engine (Workers)

- [x] 2.1 Integrate Playwright + axe-core in the Worker to evaluate WCAG 2.2 criteria
- [x] 2.2 Implement "Pre-Navigation Scripts" execution before running scans for authenticated sites
- [x] 2.3 Upload element screenshots and full HTML dumps to MinIO during scans
- [x] 2.4 Update job progress via BullMQ to notify NestJS API of scan completion percentage

## 3. Web Dashboard & API (NestJS + React)

- [x] 3.1 Develop NestJS REST endpoints for CRUD operations (Projects, Scans, URLs)
- [x] 3.2 Implement WebSockets (Socket.io) in NestJS and React for real-time progress bars
- [x] 3.3 Build Dashboard UI for scan results, metrics, and error filtering
- [x] 3.4 Implement the **Semi-automatic Evaluation UI** allowing humans to pass/fail manual criteria

## 4. Peruvian Compliance Module

- [x] 4.1 Implement Vp (Valor de Priorización) bulk upload feature and calculation (Vp = Vo x Ux)
- [x] 4.2 Add automated validations for `.gob.pe` domains and public administration criteria
- [x] 4.3 Add specific verification logic/flags for Lengua de Señas Peruana (criterion 1.2.6)

## 5. Report Generation

- [x] 5.1 Implement JSON export API for external CI/CD integrations
- [x] 5.2 Build Excel (ExcelJS) generator separating errors by role and fetching data from Postgres
- [x] 5.3 Develop PDF generator (pdfmake) compiling screenshots from MinIO for Executive & Technical reports
