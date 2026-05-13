# Fulfill Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable "Mark Fulfilled" button to each admin order (next to Print and Download PDF), a green "Fulfilled" badge on fulfilled orders, and a top-of-page filter dropdown (All / Unfulfilled / Fulfilled).

**Architecture:** Add a nullable `fulfilled_at` timestamp column to the `orders` table. New `POST /api/admin/orders/[id]/fulfill` endpoint takes `{ fulfilled: boolean }` and sets the timestamp to `NOW()` or `NULL`. All UI changes live in `app/admin/orders/page.tsx` (filter dropdown, badge, button + optimistic-update handler).

**Tech Stack:** Drizzle ORM + drizzle-kit migrations against Neon Postgres, Next.js 16 App Router route handler, React 19 client component for the admin orders page, `lucide-react` icons (CheckCircle, Check).

**Project convention note:** No automated test suite. Each task uses manual verification — confirm by running lint, by curl-ing the API, or by inspecting file contents.

---

## File Structure

**Modified:**
- `lib/db/schema.ts` — add `fulfilledAt` column to `ordersTable`.
- `app/admin/orders/page.tsx` — `Order` interface, filter state + dropdown, badge in collapsed card, toggle button + handler.

**Created:**
- `drizzle/<timestamp>_<auto_name>.sql` — auto-generated migration (one file).
- `app/api/admin/orders/[id]/fulfill/route.ts` — new POST endpoint.

The `drizzle/meta/` folder will also receive an update from drizzle-kit (`_journal.json` and snapshot). Commit those alongside the migration.

---

## Task 1: Schema column + auto-generated migration

**Files:**
- Modify: `lib/db/schema.ts`
- Create (auto-generated): `drizzle/<NEW_TIMESTAMP>_<auto_name>.sql` and updated `drizzle/meta/*`

- [ ] **Step 1: Add the column to the schema**

Open `lib/db/schema.ts`. Locate the `ordersTable` definition. After the existing `createdAt: timestamp("created_at").defaultNow().notNull(),` line and before the closing `});`, add:

```ts
fulfilledAt: timestamp("fulfilled_at"),
```

(Nullable — no `.notNull()`. No default — Drizzle will treat absence as NULL.)

The full `ordersTable` block should now look like:
```ts
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerFirstName: text("customer_first_name").notNull(),
  customerLastName: text("customer_last_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  storeAddress: text("store_address"),
  note: text("note"),
  items: text("items").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  submittedAt: timestamp("submitted_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
});
```

- [ ] **Step 2: Generate the migration SQL**

Run:
```bash
npm run db:generate
```

Expected output: drizzle-kit creates a new file under `drizzle/` named like `<14-digit-timestamp>_<two-word-name>.sql` (e.g. `20260512100000_silly_capybara.sql`) plus updates `drizzle/meta/_journal.json` and adds a new `drizzle/meta/<NNNN>_snapshot.json`.

Open the generated `.sql` file and confirm it contains a single statement matching:
```sql
ALTER TABLE "orders" ADD COLUMN "fulfilled_at" timestamp;
```

If the generator produced more than that (unexpected — would indicate stale snapshot state), STOP and report. Otherwise proceed.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no NEW errors (pre-existing errors in `app/admin/layout.tsx` are unrelated).

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(db): add fulfilled_at column to orders"
```

---

## Task 2: Apply the migration to the live database

**Files:** None (database change only).

This task runs the migration against the project's Neon database — the same one production uses. The migration is a single nullable `ADD COLUMN`, which is safe and instant on a small table.

- [ ] **Step 1: Apply the migration**

Run:
```bash
npm run db:migrate
```

This invokes `netlify dev:exec drizzle-kit migrate` which executes any pending migrations against the live Neon DB.

Expected output: drizzle-kit reports applying one migration with the new timestamp; final line should indicate success (no error stack trace).

If the command fails because the Netlify dev environment isn't set up (e.g., `netlify` CLI missing or unlinked), STOP and report BLOCKED — the user can run it themselves.

- [ ] **Step 2: Verify the column exists**

If the dev server is already running, leave it alone. Otherwise, you don't need to start it for this step — just trust the migrate command's success output. (Optional verification: open a Drizzle Studio session via `npm run db:studio` and visually confirm the `fulfilled_at` column appears on the `orders` table.)

- [ ] **Step 3: No commit needed** — this task only mutates the database, not the codebase.

---

## Task 3: New API route `POST /api/admin/orders/[id]/fulfill`

**Files:**
- Create: `app/api/admin/orders/[id]/fulfill/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/orders/[id]/fulfill/route.ts` with exact contents:

```ts
import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { fulfilled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.fulfilled !== "boolean") {
    return NextResponse.json(
      { error: "Body must include { fulfilled: boolean }" },
      { status: 400 }
    );
  }

  const db = getDb();
  const updated = await db
    .update(ordersTable)
    .set({ fulfilledAt: body.fulfilled ? new Date() : null })
    .where(eq(ordersTable.id, orderId))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated[0]);
}
```

- [ ] **Step 2: Manual verification (auth gate)**

Ensure the dev server is running. If `npm run dev` is not already running, start it in the background: `npm run dev` (run_in_background=true). Wait 5 seconds.

Then sanity-check the route's auth gate without a token:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/admin/orders/1/fulfill -H "Content-Type: application/json" -d '{"fulfilled":true}'
```
Expected output: `401`

Then check invalid-body handling (must include a token to pass auth — but a malformed JWT also yields 401 from the auth gate. So this sanity check exercises the auth path again, which is fine). Acceptable result: `401` (auth fails before body validation) OR `400` if you supplied a valid admin token.

If you have a real admin token available from the browser session, optionally test the happy path with a known order id:
```bash
curl -s -X POST http://localhost:3000/api/admin/orders/<known-id>/fulfill \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fulfilled":true}'
```
Expected: JSON body of the updated order with `fulfilledAt` set to a recent ISO timestamp. Otherwise skip this optional check.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no NEW errors. Confirm zero errors from the new file.

- [ ] **Step 4: Commit**

```bash
git add 'app/api/admin/orders/[id]/fulfill/route.ts'
git commit -m "feat: add POST /api/admin/orders/[id]/fulfill"
```

---

## Task 4: Update `Order` interface + add filter state and dropdown

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Add `fulfilledAt` to the `Order` interface**

In `app/admin/orders/page.tsx`, locate the `Order` interface (around lines 5-17). Add `fulfilledAt: string | null;` immediately after the existing `createdAt: string;` line. The interface should become:

```tsx
interface Order {
  id: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  storeAddress: string | null;
  note: string | null;
  items: string;
  totalPrice: string;
  submittedAt: string;
  createdAt: string;
  fulfilledAt: string | null;
}
```

- [ ] **Step 2: Add filter state**

In the component body, locate the existing state declarations near the top (around lines 33-35: `useState<Order[]>([])`, `useState<Record<string,string>>({})`, `useState<number | null>(null)`).

After the last of those (`const [expanded, setExpanded] = useState<number | null>(null);`), add:

```tsx
const [filter, setFilter] = useState<"all" | "unfulfilled" | "fulfilled">("all");
```

- [ ] **Step 3: Compute `filteredOrders`**

After the existing `formatPrice` helper definition (near the start of the component, before the JSX return), add this derivation:

```tsx
const filteredOrders = orders.filter((o) => {
  if (filter === "fulfilled") return o.fulfilledAt !== null;
  if (filter === "unfulfilled") return o.fulfilledAt === null;
  return true;
});
```

- [ ] **Step 4: Wrap the heading with the filter dropdown**

In the JSX, locate the existing heading line:
```tsx
<h1 className="text-2xl font-black mb-6">Orders</h1>
```

Replace it with this heading row that includes the dropdown:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
  <h1 className="text-2xl font-black">Orders</h1>
  <select
    value={filter}
    onChange={(e) => setFilter(e.target.value as "all" | "unfulfilled" | "fulfilled")}
    className="border border-[var(--candy-border)] rounded-[14px] py-2 px-3 bg-white text-sm w-full sm:w-auto"
  >
    <option value="all">All</option>
    <option value="unfulfilled">Unfulfilled</option>
    <option value="fulfilled">Fulfilled</option>
  </select>
</div>
```

Note: the `mb-6` moved from the `<h1>` to the wrapping div.

- [ ] **Step 5: Replace the orders consumer**

In the JSX, find the existing `orders.length === 0` check and the `orders.map(...)` call. Replace both occurrences:

- `{orders.length === 0 ? (` → `{filteredOrders.length === 0 ? (`
- `{orders.map((order) => {` → `{filteredOrders.map((order) => {`

The empty-state message can stay as "No orders yet." — it will appear when no orders match the filter, which is acceptable copy. (If you want filter-aware copy, that's a future enhancement.)

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: no NEW errors.

- [ ] **Step 7: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "feat: add fulfillment filter dropdown to admin orders"
```

---

## Task 5: Add "Fulfilled" badge to collapsed order card

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Add the badge next to the customer name**

In `app/admin/orders/page.tsx`, locate the collapsed-card summary row. The customer-name container is currently:

```tsx
<div className="font-bold text-sm">
  {order.customerFirstName} {order.customerLastName}
</div>
```

Replace with:

```tsx
<div className="font-bold text-sm flex items-center gap-2 flex-wrap">
  <span>{order.customerFirstName} {order.customerLastName}</span>
  {order.fulfilledAt && (
    <span className="inline-block bg-[var(--candy-green-bg)] text-[#065F46] text-xs font-bold rounded-full py-0.5 px-2">
      Fulfilled
    </span>
  )}
</div>
```

The badge only renders when `fulfilledAt` is set. The flex container ensures name + badge sit on the same line on desktop and wrap on narrow mobile.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no NEW errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "feat: add Fulfilled badge to admin order cards"
```

---

## Task 6: Toggle handler + Mark Fulfilled / Fulfilled button

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Add `CheckCircle` and `Check` to the lucide imports**

Locate the existing lucide-react import (added in the previous feature):
```tsx
import { Printer, Download } from "lucide-react";
```

Change to:
```tsx
import { Printer, Download, CheckCircle, Check } from "lucide-react";
```

- [ ] **Step 2: Add the `toggleFulfilled` handler**

Inside the `AdminOrdersPage` component, after the existing `formatPrice` helper function and before the JSX `return`, add:

```tsx
async function toggleFulfilled(order: Order) {
  const wasFulfilled = order.fulfilledAt !== null;
  const nextValue = !wasFulfilled;

  // Optimistic update with client-side timestamp
  setOrders((prev) =>
    prev.map((o) =>
      o.id === order.id
        ? { ...o, fulfilledAt: nextValue ? new Date().toISOString() : null }
        : o
    )
  );

  const token = sessionStorage.getItem("nf_token");
  const res = await fetch(`/api/admin/orders/${order.id}/fulfill`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fulfilled: nextValue }),
  });

  if (!res.ok) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, fulfilledAt: order.fulfilledAt } : o
      )
    );
    alert("Failed to update fulfillment status.");
  }
}
```

The optimistic update uses the client clock for the timestamp. The UI only checks presence/absence, never displays the value, so the small drift versus the server's authoritative timestamp is harmless.

- [ ] **Step 3: Add the button to the action row**

Locate the existing action row inside the expanded panel (added in the previous feature) — currently:

```tsx
<div className="flex gap-2 mb-3">
  <button
    onClick={(e) => {
      e.stopPropagation();
      window.open(`/admin/orders/${order.id}/invoice?print=1`, "_blank");
    }}
    className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
  >
    <Printer className="size-3.5" /> Print
  </button>
  <button
    onClick={(e) => {
      e.stopPropagation();
      window.open(`/admin/orders/${order.id}/invoice?download=1`, "_blank");
    }}
    className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
  >
    <Download className="size-3.5" /> Download PDF
  </button>
</div>
```

Update the wrapping div to add `flex-wrap` (so the third button wraps cleanly on narrow widths), and add the fulfillment button as a third sibling. The full replacement:

```tsx
<div className="flex gap-2 mb-3 flex-wrap">
  <button
    onClick={(e) => {
      e.stopPropagation();
      window.open(`/admin/orders/${order.id}/invoice?print=1`, "_blank");
    }}
    className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
  >
    <Printer className="size-3.5" /> Print
  </button>
  <button
    onClick={(e) => {
      e.stopPropagation();
      window.open(`/admin/orders/${order.id}/invoice?download=1`, "_blank");
    }}
    className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
  >
    <Download className="size-3.5" /> Download PDF
  </button>
  {order.fulfilledAt ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFulfilled(order);
      }}
      className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-[var(--candy-muted)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
    >
      <Check className="size-3.5" /> Fulfilled (click to undo)
    </button>
  ) : (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFulfilled(order);
      }}
      className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] text-xs font-bold hover:bg-[rgba(52,211,153,0.28)] transition-colors"
    >
      <CheckCircle className="size-3.5" /> Mark Fulfilled
    </button>
  )}
</div>
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no NEW errors. Confirm `Check` and `CheckCircle` imports are now used (the new buttons reference them).

- [ ] **Step 5: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "feat: add Mark Fulfilled toggle button to admin orders"
```

---

## Task 7: End-to-end manual verification

**Files:** None — verification only.

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: build succeeds. The new `/api/admin/orders/[id]/fulfill` route appears in the route list. No TypeScript errors.

- [ ] **Step 2: End-to-end fulfillment walkthrough**

Run: `netlify dev` (not `npm run dev` — the existing project needs Netlify Neon bindings to actually fetch order data; `npm run dev` returns 500 on every page).

Wait for the dev server to be ready. Log into the admin dashboard. Open the orders page.

Verify:
- An order with `fulfilledAt = null` shows no badge.
- Expand it. The action row has three buttons: Print, Download PDF, Mark Fulfilled (green).
- Click Mark Fulfilled. Button immediately changes to "Fulfilled (click to undo)" (muted gray). Green "Fulfilled" badge appears next to the customer name on the collapsed view.
- Refresh the page. State persists — badge still there, button still in undo state.
- Click "Fulfilled (click to undo)". Button reverts to green "Mark Fulfilled". Badge disappears. Refresh — state persists.

- [ ] **Step 3: Filter walkthrough**

Make sure you have at least one fulfilled and one unfulfilled order (use the toggle button to set up if needed).

- Default filter is "All" — both shown.
- Switch to "Unfulfilled" — only unfulfilled orders shown.
- Switch to "Fulfilled" — only fulfilled orders shown.

- [ ] **Step 4: Error path**

In DevTools, set Network → Offline. Click Mark Fulfilled on an unfulfilled order. Expected:
- The button briefly shows the fulfilled state (optimistic UI).
- Then reverts to unfulfilled.
- An alert appears: "Failed to update fulfillment status."

Restore network. Click the button again — should now succeed.

- [ ] **Step 5: Final lint pass**

Run: `npm run lint`
Expected: no NEW errors (pre-existing errors in `app/admin/layout.tsx` and the unrelated `<img>` warnings are not this feature's concern).

- [ ] **Step 6: No commit needed** — verification only.
