# Plan: Botón de cancelar escaneo

## Objetivo
Agregar un botón de cancelación visible durante la ejecución de escaneos para evitar que el usuario quede bloqueado si el proceso falla o se cuelga.

## Alcance
- Backend API: endpoint para cancelar un escaneo en progreso.
- Worker: detección de cancelación y salida limpia del loop de procesamiento.
- Frontend: botón de cancelar en la UI del historial de escaneos.

---

## 1. Estado de escaneo (backend)

**Archivo:** `api/src/scans/entities/scan.entity.ts`  
**Línea:** 13 — el comentario enumera `// pending, running, completed, failed`  
**Acción:** Agregar `cancelled` como estado válido.

**Archivo:** `api/src/scans/scans.service.ts`  
**Acción:** Crear método `cancelScan(id: string, ownerId: string | null)` que:
- Valide que el scan exista y pertenezca al usuario (o sea público).
- Verifique que el estado actual permita cancelación (`pending` o `running`).
- Actualice el estado a `cancelled`.
- Retorne el scan actualizado.

**Archivo:** `api/src/scans/scans.controller.ts`  
**Acción:** Agregar endpoint:
```ts
@Patch(':id/cancel')
cancel(@Param('id') id: string, @CurrentUser() user: ..., @Req() request: { authMode?: string })
```
- Aplicar `@RateLimit({ scope: 'scan', ... })` igual que los demás endpoints de scan.
- Proteger con autenticación existente.

---

## 2. Worker - Detección de cancelación

**Archivo:** `worker/src/processor.ts`  
**Línea:** 114 — inicio del loop `for (let i = 0; i < totalUrls; i++)`  
**Acción:** Al inicio de cada iteración (antes de procesar la URL), ejecutar:
```sql
SELECT status FROM scans WHERE id = $1
```
Si el estado es `cancelled`, salir del loop y marcar el scan como `cancelled` en DB.

Opcional: en `worker/src/scanner.ts`, pasar un `AbortSignal` a `scanUrl` para abortar requests HTTP individuales si es necesario.

---

## 3. Frontend - UI de cancelar

**Archivo:** `frontend/src/views/ProjectDetailView.tsx`  
**Línea:** 384 — `const isRunning = scan.status === 'running' || ...`  
**Acciones:**
- Agregar prop `onCancelScan?: (scanId: string) => void` a `ProjectDetailViewProps`.
- En la card del scan cuando `isRunning` sea true, mostrar un botón con ícono `X` o texto "Cancelar" en la cabecera de la card (línea ~409, junto al título).
- El botón debe llamar a `onCancelScan(scan.id)` y deshabilitarse mientras se envía la petición.

**Archivo:** `frontend/src/App.tsx`  
**Línea:** 864 — `handleTriggerScan` (referencia de ubicación)  
**Acciones:**
- Implementar `handleCancelScan(scanId: string)` que llame a `PATCH /scans/${scanId}/cancel`.
- Pasar `onCancelScan={handleCancelScan}` a `ProjectDetailView`.
- Al recibir confirmación, actualizar el scan localmente a estado `cancelled` y refrescar la lista.

---

## 4. Estados visuales

**Archivo:** `frontend/src/views/ProjectDetailView.tsx`  
**Línea:** 387-395 — lógica de clase CSS por estado  
**Acción:** Agregar caso para `cancelled`:
```ts
scan.status === 'cancelled' ? 'scan-history-card-canceled'
```

**Archivo:** `frontend/src/views/ProjectDetailView.tsx`  
**Línea:** 151 — `getScanStatusLabel`  
**Acción:** Agregar caso:
```ts
if (status === 'cancelled') return 'Cancelado';
```

**Archivo:** `frontend/src/index.css`  
**Línea:** ~6660 — bloque `.scan-history-card-pending, .scan-history-card-running`  
**Acción:** Agregar estilo `.scan-history-card-canceled` con borde y fondo en tonos grises/neutrales, similar al patrón de las otras cards.

---

## 5. Consideraciones

- **No borrar el scan al cancelar:** Se preserva el registro para auditoría, pero no se muestran resultados parciales.
- **Idempotencia:** Cancelar un scan ya completado, fallido o cancelado debe retornar 400/409 con mensaje claro.
- **Progress bar:** Al cancelar, detener updates de progreso y dejar la barra en su último valor con estado "Cancelado".
- **Extension:** La extensión no requiere cambios; envía el resultado al endpoint existente y el backend lo rechaza si el scan ya fue cancelado.
- **Socket/progreso en vivo:** El frontend actualiza progreso vía socket (`App.tsx:584`). Al cancelar, el worker deja de enviar progreso y la UI debe reflejar el estado final por polling o al refrescar.

---

## Orden de implementación

1. Agregar estado `cancelled` al Scan entity.
2. Crear endpoint `PATCH :id/cancel` en scans controller + service.
3. Modificar worker `processor.ts` para verificar estado y abortar loop.
4. Agregar botón de cancelar en `ProjectDetailView` con prop `onCancelScan`.
5. Implementar `handleCancelScan` en `App.tsx`.
6. Agregar estilo CSS `scan-history-card-canceled` y label de estado "Cancelado".
7. Verificar flujo completo: iniciar scan → ver progreso → cancelar → ver estado cancelado.
