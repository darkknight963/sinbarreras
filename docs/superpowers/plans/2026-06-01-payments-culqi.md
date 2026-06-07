# Payments with Culqi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Peru-first billing with Culqi so authenticated users can choose monthly or annual plans, subscribe safely, and have the backend remain the source of truth for payment status.

**Architecture:** Keep billing isolated in a new NestJS `billing` module. The backend owns plans, subscription state, and all Culqi API calls; the frontend only renders plans, collects the user's choice, and starts checkout. Persist the active plan on the `User` record plus a dedicated subscription entity so auth, projects, and scans can keep using the existing ownership model without billing logic leaking into them.

**Tech Stack:** NestJS, TypeORM, React, Vite, Culqi Checkout JS, Jest, Vitest

---

### Task 1: Add the billing data model and expose subscription state on the user session

**Files:**
- Create: `api/src/billing/entities/billing-subscription.entity.ts`
- Create: `api/src/billing/billing.types.ts`
- Create: `api/src/auth/auth.service.spec.ts`
- Modify: `api/src/auth/entities/user.entity.ts`
- Modify: `api/src/auth/auth.service.ts`
- Modify: `api/src/app.module.ts`
- Modify: `api/src/auth/dto/auth.dto.ts` only if the auth response type needs explicit billing fields in the controller payload

- [ ] **Step 1: Write the failing tests**

Add a Jest test that creates a `User` with billing fields and verifies `AuthService.me()` returns them:

```ts
it('returns billing state in me()', async () => {
  const user = await userRepository.save({
    email: 'cliente@demo.pe',
    passwordHash: 'salt:hash',
    fullName: 'Cliente Demo',
    companyName: 'Demo SAC',
    role: 'owner',
    isActive: true,
    billingStatus: 'active',
    billingPlan: 'monthly',
    billingProvider: 'culqi',
    billingCurrency: 'PEN',
    billingPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
  });

  await expect(authService.me(user.id)).resolves.toMatchObject({
    id: user.id,
    email: 'cliente@demo.pe',
    billingStatus: 'active',
    billingPlan: 'monthly',
    billingProvider: 'culqi',
    billingCurrency: 'PEN',
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- auth.service.spec.ts --runInBand`

Expected: failure because the billing fields do not exist yet.

- [ ] **Step 3: Implement the minimal model and serialization**

Add the billing columns to `User` and the new subscription entity:

```ts
export type BillingProvider = 'culqi';
export type BillingPlan = 'monthly' | 'annual';
export type BillingStatus = 'inactive' | 'pending' | 'active' | 'past_due' | 'canceled';
```

Use these fields on `User`:

```ts
@Column({ default: 'inactive' })
billingStatus!: BillingStatus;

@Column({ nullable: true })
billingPlan!: BillingPlan | null;

@Column({ default: 'culqi' })
billingProvider!: BillingProvider;

@Column({ nullable: true })
billingCurrency!: 'PEN' | 'USD' | null;

@Column({ nullable: true, type: 'timestamptz' })
billingPeriodEnd!: Date | null;

@Column({ nullable: true })
billingCustomerId!: string | null;

@Column({ nullable: true })
billingSubscriptionId!: string | null;
```

Create `BillingSubscription` to keep provider ids and lifecycle history:

```ts
@Entity('billing_subscriptions')
export class BillingSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  user!: User;

  @Column({ default: 'culqi' })
  provider!: BillingProvider;

  @Column()
  plan!: BillingPlan;

  @Column({ default: 'inactive' })
  status!: BillingStatus;

  @Column({ nullable: true })
  providerCustomerId!: string | null;

  @Column({ nullable: true })
  providerSubscriptionId!: string | null;

  @Column({ nullable: true })
  providerCardId!: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  currentPeriodEnd!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

Update `AuthService.serializeUser()` so `me()` and session login/register responses include the billing fields.

Register the new entity in `AppModule` TypeORM config and feature module imports.

- [ ] **Step 4: Run the backend tests and build**

Run:

```bash
npm test -- auth.service.spec.ts --runInBand
npm run build
```

Expected: tests pass and the backend compiles with the new columns.

### Task 2: Build the Culqi billing service, plans endpoint, and subscription lifecycle endpoints

**Files:**
- Create: `api/src/billing/billing.module.ts`
- Create: `api/src/billing/billing.service.ts`
- Create: `api/src/billing/billing.controller.ts`
- Create: `api/src/billing/culqi.client.ts`
- Create: `api/src/billing/dto/create-checkout-session.dto.ts`
- Create: `api/src/billing/dto/confirm-subscription.dto.ts`
- Create: `api/src/billing/dto/culqi-webhook.dto.ts`
- Modify: `api/src/app.module.ts`
- Modify: `api/src/auth/auth.module.ts` if the billing service needs access to auth helpers

- [ ] **Step 1: Write the failing tests**

Add controller/service tests that assert:
- `/billing/plans` returns `monthly` and `annual`
- `/billing/checkout` rejects unknown plan codes
- `/billing/checkout` returns a Culqi checkout payload when the user is authenticated
- `/billing/webhooks/culqi` updates the subscription state when a subscription event arrives

Example test for the plans endpoint:

```ts
it('returns the two public plans', async () => {
  await expect(billingService.listPlans()).resolves.toEqual([
    expect.objectContaining({ code: 'monthly', currency: 'PEN' }),
    expect.objectContaining({ code: 'annual', currency: 'PEN' }),
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- billing.service.spec.ts billing.controller.spec.ts --runInBand`

Expected: failures because the module and endpoints do not exist yet.

- [ ] **Step 3: Implement the Culqi client and plan catalog**

Implement a small client wrapper around Culqi API calls so the rest of the app never talks to the provider directly:

```ts
export interface CulqiPlan {
  code: 'monthly' | 'annual';
  name: string;
  amount: number;
  currency: 'PEN' | 'USD';
  intervalUnitTime: number;
  providerPlanId: string;
}
```

Use environment variables for provider ids and secrets:
- `CULQI_PUBLIC_KEY`
- `CULQI_PRIVATE_KEY`
- `CULQI_MONTHLY_PLAN_ID`
- `CULQI_ANNUAL_PLAN_ID`
- `BILLING_DEFAULT_CURRENCY`
- `APP_PUBLIC_URL`

Keep the plan catalog in one place so frontend and backend stay consistent.

Implement these service methods:
- `listPlans()`
- `createCheckoutSession(userId, planCode)`
- `confirmSubscription(userId, planCode, culqiToken)`
- `handleWebhook(payload)`
- `cancelSubscription(userId)`
- `getUserBilling(userId)`

Make the controller expose:
- `GET /billing/plans`
- `GET /billing/me`
- `POST /billing/checkout`
- `POST /billing/confirm`
- `POST /billing/cancel`
- `POST /billing/webhooks/culqi`

The webhook route should be public, but the subscription-changing routes must still require the existing auth guard/session.

- [ ] **Step 4: Run the service tests until they pass**

Run:

```bash
npm test -- billing.service.spec.ts billing.controller.spec.ts --runInBand
```

Expected: tests pass and the controller returns plan and checkout data without reaching the frontend.

- [ ] **Step 5: Run the backend build**

Run: `npm run build`

Expected: the app compiles with the new billing module wired into `AppModule`.

### Task 3: Add the billing screen and Culqi checkout flow to the frontend

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/index.html`
- Create: `frontend/src/billing.ts` only if the checkout logic becomes large enough to isolate
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write the failing frontend test**

Add a Vitest test that renders the logged-in app and verifies:
- a billing entry point exists
- the plan cards show monthly and annual pricing
- clicking the subscribe CTA calls the billing checkout endpoint

Example:

```ts
it('shows billing plans and starts checkout', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ token: 'token', user: mockUser }));
  fetchMock.mockResponseOnce(JSON.stringify([{ code: 'monthly' }, { code: 'annual' }]));

  render(<App />);
  await screen.findByText('Planes');
  expect(screen.getByText('Mensual')).toBeInTheDocument();
  expect(screen.getByText('Anual')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run App.test.tsx`

Expected: the billing UI is missing.

- [ ] **Step 3: Implement the UI and Culqi script loading**

Add a billing view state to the existing app without changing project/report behavior:

```ts
const [view, setView] = useState<'projects' | 'project' | 'scan' | 'billing'>('projects');
```

Render a `Planes` section for authenticated users that:
- shows the active subscription state from `/billing/me`
- renders `Mensual` and `Anual` cards
- highlights the recommended plan
- sends the selected plan to `/billing/checkout`
- opens Culqi checkout using the public key from env or the backend response

Add Culqi's checkout script in `frontend/index.html` so the browser can open the payment modal.

Keep the existing project dashboard as the default landing area after auth. The billing screen should be reachable from a header action or account menu, not by replacing the whole app shell.

- [ ] **Step 4: Update the frontend test and run it**

Run:

```bash
npm test -- --run App.test.tsx
```

Expected: the new billing UI and checkout trigger are covered.

- [ ] **Step 5: Build the frontend**

Run: `npm run build`

Expected: the app compiles with the new billing view and script tag.

### Task 4: Verify the payment lifecycle end to end and harden the release surface

**Files:**
- Modify: `api/src/billing/billing.controller.ts`
- Modify: `api/src/billing/billing.service.ts`
- Modify: `api/src/billing/billing.controller.spec.ts`
- Modify: `api/src/billing/billing.service.spec.ts`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx` if small UX fixes are needed after verification

- [ ] **Step 1: Add webhook and cancellation coverage**

Write tests that simulate:
- subscription created successfully
- subscription marked active
- subscription canceled
- subscription moved to past due or failed

Example:

```ts
it('marks the user active when Culqi reports a live subscription', async () => {
  await billingService.handleWebhook({
    event: 'subscription.creation.succeeded',
    data: { id: 'sxn_test_123', plan: { plan_id: 'pln_test_monthly' }, customer: { email: 'cliente@demo.pe' } },
  });

  await expect(userRepository.findOneBy({ email: 'cliente@demo.pe' })).resolves.toMatchObject({
    billingStatus: 'active',
    billingPlan: 'monthly',
  });
});
```

- [ ] **Step 2: Run the targeted tests**

Run:

```bash
npm test -- billing.controller.spec.ts billing.service.spec.ts --runInBand
```

Expected: the webhook and cancellation state transitions are correct.

- [ ] **Step 3: Sanity-check the full app**

Run:

```bash
npm test -- --run App.test.tsx
npm run build
```

Expected: frontend still works and the payment UI does not regress the existing project experience.

- [ ] **Step 4: Commit the payment work in one clean unit**

Commit message:

```bash
git add api/src/billing api/src/auth/entities/user.entity.ts api/src/auth/auth.service.ts api/src/app.module.ts frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/types.ts frontend/index.html docs/superpowers/plans/2026-06-01-payments-culqi.md
git commit -m "feat: add culqi billing flow"
```

**Coverage check:** Task 1 covers persistent billing state, Task 2 covers the backend Culqi flow, Task 3 covers the customer-facing purchase flow, and Task 4 covers webhook-driven lifecycle updates and release verification.
