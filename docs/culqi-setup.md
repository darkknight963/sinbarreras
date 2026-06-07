# Culqi setup

This project uses **Culqi Checkout + Suscripciones + Culqi API**.
It does not use Culqi Link for the subscription flow.

## What to create in Culqi

1. Create or sign in to your Culqi merchant account.
2. Open the **CulqiPanel**.
3. Go to **Desarrollo / API Keys**.
4. Copy the public and private keys for the environment you need:
   - `pk_test_...` / `sk_test_...` for integration
   - `pk_live_...` / `sk_live_...` for production
5. Go to **Suscripciones / Planes**.
6. Create these plans:
   - Monthly PEN
   - Annual PEN
   - Monthly USD
   - Annual USD
7. Copy each returned plan id (`pln_test_...` or `pln_live_...`).

## Variables to set

### Backend

Fill these in `api/.env`:

```bash
CULQI_API_BASE_URL=https://api.culqi.com/v2
CULQI_PUBLIC_KEY=pk_test_xxx
CULQI_SECRET_KEY=sk_test_xxx
CULQI_MONTHLY_PEN_PLAN_ID=pln_test_xxx
CULQI_ANNUAL_PEN_PLAN_ID=pln_test_xxx
CULQI_MONTHLY_USD_PLAN_ID=pln_test_xxx
CULQI_ANNUAL_USD_PLAN_ID=pln_test_xxx
CULQI_MONTHLY_PEN_AMOUNT=4900
CULQI_ANNUAL_PEN_AMOUNT=49000
CULQI_MONTHLY_USD_AMOUNT=15
CULQI_ANNUAL_USD_AMOUNT=150
```

### Frontend

Fill these in `frontend/.env`:

```bash
VITE_CULQI_PUBLIC_KEY=pk_test_xxx
```

## How the flow works

1. User clicks a plan in the billing screen.
2. Frontend calls `POST /billing/checkout`.
3. Backend returns the public key and amount.
4. Culqi Checkout opens and captures the card.
5. Frontend sends the token to `POST /billing/confirm`.
6. Backend creates:
   - customer
   - card
   - subscription
7. Culqi webhooks keep the subscription state synchronized.

## Webhook

Register the public endpoint in Culqi:

```text
POST https://your-domain.com/billing/webhooks/culqi
```

For local development you can use a tunnel such as ngrok or Cloudflare Tunnel.

## Which product to use

- Use **Culqi Checkout** for the card capture UI.
- Use **Culqi Suscripciones** for recurring billing.
- Use **Culqi Link** only if you want a standalone payment link, not an in-app subscription flow.
