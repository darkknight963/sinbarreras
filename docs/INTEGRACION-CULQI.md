# Instructivo: Integración de Suscripciones con Culqi (CulqiOnline)

> Guía definitiva basada en una integración real funcionando en producción (julio 2026).
> Incluye todas las trampas descubiertas para que la próxima integración funcione a la primera.

---

## 1. Arquitectura del flujo

Una suscripción en Culqi requiere **4 pasos encadenados**, todos desde el backend excepto el primero:

```
[Navegador]  Culqi.js v4  →  genera TOKEN (tkn_live_...)   ← único paso frontend
     ↓ (enviar token al backend, HTTPS, de un solo uso, expira en ~5 min)
[Backend]    POST /v2/customers                →  cus_live_...
[Backend]    POST /v2/cards                    →  crd_live_...   (usa el token)
[Backend]    POST /v2/recurrent/subscriptions/create  →  sxn_live_...
```

**El token es de UN SOLO USO.** Cada reintento de pago necesita que el usuario vuelva a ingresar la tarjeta para generar un token nuevo.

---

## 2. Prerrequisitos en CulqiPanel

1. **API Keys** (Desarrollo → API Keys): llave pública `pk_live_...` (frontend) y secreta `sk_live_...` (backend, JAMÁS en el frontend ni en chats/repos).
2. **Plan creado** (Suscripciones → Planes): estado **Activo**. Guarda el `pln_live_...`.
   - El plan se puede crear por API: `POST /v2/recurrent/plans/create`.
3. **Webhooks** (Desarrollo → Webhooks): registrar la URL pública del backend para los 4 eventos de suscripción (ver §7). Activar **Autenticación** (Basic Auth) y definir usuario/contraseña.
4. **RSA Keys** (Desarrollo → RSA Keys): **OPCIONAL** — ver §6 antes de crear una. Spoiler: no la uses para suscripciones.

---

## 3. Frontend: Culqi.js v4 (Checkout)

### Carga del script

En `index.html` (NO inyectar dinámicamente, es menos confiable):

```html
<link rel="preconnect" href="https://checkout.culqi.com" crossorigin />
<script src="https://checkout.culqi.com/js/v4" defer></script>
```

⚠️ La URL correcta es `https://checkout.culqi.com/js/v4`. (No existe `js.culqi.com/checkout-js`.)

### Inicialización y apertura

```ts
window.Culqi.publicKey = 'pk_live_...';
window.Culqi.settings({
  title: 'Mi Empresa',
  currency: 'PEN',
  description: 'Plan Pro Mensual',
  amount: 7900,          // en CENTAVOS (S/79.00 = 7900)
  order: '',
  email: userEmail,      // ⚠️ OBLIGATORIO incluirlo: asocia el token al cliente
});
window.Culqi.open();
```

### Callback global

Culqi invoca `window.culqi()` (minúscula) cuando el usuario termina:

```ts
window.culqi = async () => {
  if (window.Culqi?.token) {
    const token = window.Culqi.token.id;   // "tkn_live_..."
    window.Culqi.close();                  // ⚠️ cerrar el widget: NO se cierra solo
    await enviarAlBackend(token);          // POST a tu endpoint de checkout
  } else if (window.Culqi?.error) {
    mostrarError(window.Culqi.error.user_message);
  }
};
```

Detalles:
- Registrar `window.culqi` ANTES de llamar `Culqi.open()`, y limpiarlo al desmontar el componente.
- `Culqi.close()` es imprescindible: tras un pago exitoso el iframe queda abierto si no lo llamas.
- En DevTools, el widget corre en un `<iframe>`: para ver la red de tu app selecciona el frame `top`.

---

## 4. Backend: rutas y contratos EXACTOS

Base URL: `https://api.culqi.com/v2` (es `culqi.com`, no "culqui").
Auth: header `Authorization: Bearer sk_live_...`.

### Headers en TODAS las peticiones (los que envía el SDK oficial)

```
Authorization: Bearer sk_live_...
Content-Type: application/json
x-api-version: 2
x-culqi-env: live            (o "test")
x-culqi-client: culqi-go     (o el nombre de tu cliente)
x-culqi-client-version: 1.0.0
```

### 4.1 Crear cliente — `POST /customers`

```json
{
  "first_name": "Nombre",
  "last_name": "Apellido",
  "email": "cliente@correo.com",
  "address": "Av. Principal 123",
  "address_city": "Lima",
  "country_code": "PE",
  "phone_number": "51900000001"
}
```
→ `201` con `id: "cus_live_..."`. Todos los campos son obligatorios.
**Guarda el `cus_live_...` en tu BD y reutilízalo** — pero SOLO si empieza con `cus_` (ver §8, trampa del provider anterior).

### 4.2 Crear tarjeta — `POST /cards`

```json
{ "customer_id": "cus_live_...", "token_id": "tkn_live_..." }
```
→ `201` con `id: "crd_live_..."`.
El token del checkout widget se usa aquí directamente, sin transformación.

### 4.3 Crear suscripción — `POST /recurrent/subscriptions/create`

⚠️ **La ruta es `/recurrent/subscriptions/create`. `POST /subscriptions` NO EXISTE** (devuelve 401 "Ruta inválida").

```json
{ "card_id": "crd_live_...", "plan_id": "pln_live_...", "tyc": true }
```
→ `201` con `id: "sxn_live_..."`.
- `tyc` (aceptación de términos) es **obligatorio**.
- NO lleva `customer_id` — se infiere de la tarjeta.
- `metadata` es opcional.
- La respuesta puede no incluir card/plan/customer: persiste los que ya tienes.

### 4.4 Otras operaciones

| Operación | Ruta |
|---|---|
| Obtener plan | `GET /recurrent/plans/{pln_...}` |
| Crear plan | `POST /recurrent/plans/create` |
| Cancelar suscripción | `DELETE /recurrent/subscriptions/{sxn_...}` |

---

## 5. ⚠️ NO uses encriptación RSA para suscripciones

Culqi ofrece "RSA Keys" para encriptar el body (AES-256-GCM + RSA-OAEP). **Hallazgos verificados en producción:**

1. **La encriptación es OPCIONAL por petición.** Tener una llave RSA activa en el panel NO obliga a encriptar: JSON plano + Bearer key funciona en **todos** los endpoints.
2. **El desencriptador de Culqi para `/recurrent/subscriptions/create` está ROTO**: un body encriptado perfectamente formado (mismo formato que funciona en `/recurrent/plans/create`) devuelve `500 {"message":"Internal server error"}` sin detalle, con cualquier llave y cualquier configuración de servicios.
3. `/customers` y `/cards` con body encriptado también devuelven **500**.

**Conclusión: manda TODO en JSON plano.** Si algún día necesitas RSA (p. ej. requisito de compliance), el formato correcto es:
- AES-256-GCM, key 32 bytes, IV 16 bytes; `encrypted_data = base64(ciphertext || authTag)` (tag anexado al final).
- Key e IV encriptados por separado con RSA-OAEP SHA-256 (`RSA_PKCS1_OAEP_PADDING`, `oaepHash: 'sha256'`).
- Body: `{ encrypted_data, encrypted_key, encrypted_iv }` + header `x-culqi-rsa-id: <uuid de la llave>`.
- Si tu contenedor es **Alpine Linux**: la llave RSA de Culqi es de 1024 bits y OpenSSL la rechaza con `ERR_OSSL_UNSUPPORTED` — agrega al Dockerfile:
  ```dockerfile
  RUN printf '[system_default_sect]\nMinProtocol = TLSv1.2\nCipherString = DEFAULT@SECLEVEL=1\n' >> /etc/ssl/openssl.cnf
  ```

---

## 6. Diccionario de errores ambiguos de Culqi (lo que más tiempo cuesta)

| Respuesta | Significado REAL | Qué revisar |
|---|---|---|
| `401` "Petición invalida, verifica los parámetros del payload" | Un **parámetro** es inválido (p. ej. `customer_id` que no existe). NO es problema de credenciales ni encriptación. | Que todos los IDs referenciados existan y tengan el prefijo correcto (`cus_`, `crd_`, `pln_`) |
| `401` "Ruta inválida, entérate de las rutas..." | La **URL no existe**. | Usa las rutas `/recurrent/...` de §4 |
| `500` `{"message":"Internal server error"}` pelado | Enviaste body **encriptado** a un endpoint cuyo desencriptador falla. | Manda JSON plano (§5) |
| `400` `crypto_error` "Ocurrieron problemas al desencriptar" | Formato RSA reconocido pero IV/tag mal construidos. | Revisar formato de §5 |

**Herramienta de oro:** CulqiPanel → Desarrollo → **API Logs** muestra cada petición con su request/response. Revísalo SIEMPRE antes de teorizar.

---

## 7. Webhooks

- **Autenticación: Basic Auth** (usuario/contraseña que configuraste en el panel), NO firma HMAC. Culqi envía `Authorization: Basic base64(user:pass)`.
- Verifica con comparación de tiempo constante (`crypto.timingSafeEqual`).
- El endpoint debe ser público (sin tu auth de sesión).

Eventos exactos (nombres verificados):

| Evento | Acción sugerida |
|---|---|
| `subscription.charge.succeeded` | Renovar `currentPeriodEnd`, estado `active` |
| `subscription.charge.failed` | Estado `past_due` |
| `subscription.cancel.succeeded` | Estado `canceled`, limpiar plan del usuario |
| `subscription.cancel.failed` | Tratar igual que succeeded o loguear para revisión |

### ⚠️ Cómo leer el payload (la trampa más silenciosa de toda la integración)

Verificado en producción: el webhook puede **llegar bien (200, auth OK) y aun así no hacer nada** si lo lees ingenuo. Dos trampas:

1. **`data` puede venir como STRING JSON**, no como objeto. Si haces `payload.data.subscription_id` sin parsear, lees `undefined` y el evento se ignora en silencio.
   ```ts
   const data = typeof payload.data === 'string' ? JSON.parse(payload.data) : (payload.data ?? {});
   ```
2. **`data.id` es el id del CARGO (`chr_...`), NO el de la suscripción (`sxn_...`)** en los eventos de cobro. Si matcheas contra tu tabla usando `data.id`, jamás coincide. Busca el id de suscripción en este orden y solo acepta `data.id` si tiene prefijo `sxn_`:
   ```ts
   const subscriptionId =
     data.subscription_id ||
     data.subscriptionId ||
     data.subscription?.id ||
     (typeof data.id === 'string' && data.id.startsWith('sxn_') ? data.id : '');
   ```

**Regla de oro**: cuando un webhook no coincida con ninguna suscripción, NO lo ignores mudo — loguea `type` + las llaves del payload + los ids candidatos (nunca el payload completo: trae datos de tarjeta). Sin ese log, este bug es invisible: todo responde 200 y las renovaciones simplemente no ocurren.

### ⚠️ No dependas al 100% de los webhooks: red de seguridad obligatoria

Si un webhook se pierde (o el matching falla como arriba), sin defensa extra pasan dos cosas graves: un usuario con cobro rechazado conserva Pro para siempre, y nadie se entera. Diseña un **job horario** con estos casos:

| Caso | Condición | Acción |
|---|---|---|
| Cancelación voluntaria | `active` + `cancelAtPeriodEnd` + período vencido | Revocar al vencer (sin gracia — pagó su mes, lo usa entero) |
| Pago fallido notificado | `past_due` + período vencido | Revocar |
| **Red de seguridad** | `active` sin cancelar + período vencido hace > 3 días sin renovarse | Revocar |
| Activaciones manuales | usuario `active` con `periodEnd` vencido hace > 3 días (aunque no exista fila de suscripción) | Revocar |

Los 3 días de gracia cubren los reintentos de cobro de Culqi y webhooks tardíos: una renovación legítima actualiza `periodEnd` vía webhook y nunca alcanza el corte. Con esto, aunque TODOS los webhooks fallen, nadie conserva Pro más de 3 días tras vencer — y los que pagan no son tocados.

---

## 8. Trampas de datos y de aplicación

1. **Residuos de un provider anterior**: si migras desde otro proveedor (p. ej. Mercado Pago), el `billingCustomerId` guardado puede ser un ID numérico ajeno. Reutiliza el customer SOLO si empieza con `cus_`; si no, crea uno nuevo y sobrescribe.
2. **Token de un solo uso**: nunca reutilices un `tkn_...`; cada intento de pago = tarjeta re-ingresada.
3. **Tarjetas duplicadas**: cada intento fallido que llegó a crear tarjeta deja una `crd_` huérfana en Culqi. Considera reutilizar la tarjeta activa del customer en vez de crear una por intento.
4. **No loguees tokens ni claves** en producción (ni siquiera prefijos de la secret key).
5. **Montos en centavos** en todos lados (S/79.00 = 7900).
6. **Emails coherentes**: el email del `settings` de Culqi.js, del customer y del usuario deben ser el mismo.
7. Si un `DELETE` de cancelación falla contra Culqi, marca la cancelación localmente igual y loguea para cancelar manualmente en el panel (no dejes al usuario atrapado).

---

## 9. Variables de entorno

```bash
CULQI_PUBLIC_KEY=pk_live_...        # frontend (Culqi.js)
CULQI_SECRET_KEY=sk_live_...        # backend, solo servidor
CULQI_PLAN_ID=pln_live_...
CULQI_MONTHLY_PEN_AMOUNT=7900       # centavos, para mostrar el precio
CULQI_WEBHOOK_USER=...              # Basic Auth del webhook
CULQI_WEBHOOK_PASSWORD=...
# Solo si se usa RSA (ver §5 — normalmente NO):
CULQI_RSA_PUBLIC_KEY=               # PEM completo; normaliza \n literales
CULQI_RSA_KEY_ID=                   # UUID de la llave (visible en la URL de edición del panel)
```

Si la variable PEM llega aplanada o con `\n` literales, reconstruye el PEM extrayendo el base64 puro y re-partiéndolo en líneas de 64 caracteres.

---

## 10. Checklist de verificación end-to-end

- [ ] `Culqi.js` carga (existe `window.Culqi` en consola, frame `top`)
- [ ] El widget abre y genera token (`tkn_live_...` visible en el POST de tu checkout, pestaña Payload)
- [ ] `POST /customers` → 201 `cus_live_...` (API Logs del panel)
- [ ] `POST /cards` → 201 `crd_live_...`
- [ ] `POST /recurrent/subscriptions/create` → 201 `sxn_live_...`
- [ ] El widget se cierra tras el pago y la UI muestra el plan activo
- [ ] El suscriptor aparece en CulqiPanel → Suscripciones → Suscriptores
- [ ] Webhook de prueba llega y responde 200 (con Basic Auth correcta) y 401 (con credenciales malas)
- [ ] El webhook tiene EFECTO, no solo responde 200: tras un `charge.failed` real, el usuario pasa a `past_due` en tu BD (si sigue `active`, revisa el parseo del payload — §7)
- [ ] El job horario de expiración revoca: cancelados al vencer, y activos sin renovar tras el período de gracia (probar cambiando fechas en BD de staging)
- [ ] Cancelación: `DELETE /recurrent/subscriptions/{id}` → el estado local pasa a cancelado
- [ ] Ninguna clave secreta en logs, frontend ni repositorio
