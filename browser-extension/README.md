# Sin Barreras - Extension de auditoria autenticada

Esta extension escanea la pestana autenticada actual sin guardar contrasenas, cookies ni sesiones. El usuario inicia sesion manualmente en el sitio auditado y luego ejecuta la extension para enviar el DOM evaluado al backend de Sin Barreras.

## Instalacion local

1. Abre Chrome o Edge.
2. Ve a `chrome://extensions`.
3. Activa `Developer mode`.
4. Selecciona `Load unpacked`.
5. Elige la carpeta `browser-extension`.

## Uso

1. En Sin Barreras crea un escaneo con `Login manual asistido`.
2. Copia el ID del escaneo mostrado en la pantalla de progreso.
3. Abre la URL auditada e inicia sesion manualmente.
4. Abre la extension en esa pestana.
5. Completa:
   - API del sistema: por ejemplo `http://localhost:3000` o la URL del backend en produccion.
   - Token de acceso: token del usuario o API token permitido por el backend.
   - ID del escaneo.
6. Presiona `Analizar pestana y enviar`.

## Alcance tecnico

- Ejecuta `axe-core` sobre el DOM vivo de la pestana autenticada.
- Captura hallazgos confirmados y revisiones manuales.
- Inventaria estructura semantica: headings, landmarks, forms, tables, iframes y controles.
- Genera recorrido de foco basico con posicion de elementos.
- Captura la vista visible actual para el mapa visual.
- Envia resultados a `POST /scans/:id/extension-result`.

## Seguridad

- La extension no lee ni envia contrasenas.
- La extension no exporta cookies ni almacenamiento de sesion.
- El token se guarda en el almacenamiento de la extension para evitar pedirlo en cada ejecucion.
- Para produccion, publica esta carpeta como extension independiente y restringe los tokens a permisos de auditoria.

## Limitaciones de esta version

- La captura visual es de la vista visible, no de toda la pagina completa.
- El usuario debe activar manualmente menus, modales o estados internos que quiera auditar antes de ejecutar la extension.
- Para igualar el pipeline completo del worker, el backend puede agregar una etapa posterior de normalizacion/enriquecimiento usando las reglas internas del sistema sobre el resultado recibido.
