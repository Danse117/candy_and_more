# Fulfill Order — Design

**Date:** 2026-05-12
**Status:** Approved

## Goal

Let admins mark a saved order as fulfilled (and undo it). The fulfillment state shows as a small green "Fulfilled" badge on the order's row in the admin orders list, and is filterable via a top-of-page dropdown (All / Unfulfilled / Fulfilled). The toggle button lives in the expanded order panel next to the existing Print and Download PDF buttons.

## Non-Goals

- Multi-state order lifecycle (pending / preparing / shipped / cancelled). Single boolean-like toggle only.
- Tracking who fulfilled the order. The timestamp is stored, but no user attribution.
- Surfacing the fulfillment timestamp in the UI. The badge and button reflect only the presence/absence of the timestamp; the actual value is never displayed.
- Persisting the filter selection across page reloads.
- Emailing the customer when an order is marked fulfilled.
- Bulk fulfill (selecting multiple orders and marking them fulfilled together).

## Architecture Overview

Four focused changes:

1. **Schema:** Add nullable `fulfilled_at TIMESTAMP` to the `orders` table. NULL = unfulfilled; a value = fulfilled at that time.
2. **New API route:** `POST /api/admin/orders/[id]/fulfill` with body `{ fulfilled: boolean }`. Sets `fulfilled_at` to `NOW()` or `NULL` based on body.
3. **Existing list endpoint:** No code change — Drizzle's `select()` automatically includes the new column in the response.
4. **Admin orders page (`app/admin/orders/page.tsx`):** Add `fulfilledAt` to the `Order` interface; add a top-of-page filter dropdown; add a green "Fulfilled" badge on the collapsed card row when set; add a "Mark Fulfilled" / "Fulfilled (click to undo)" button inside the expanded panel next to Print and Download.

No other files touched.

## Schema Change

In `lib/db/schema.ts`, add to `ordersTable`:

```ts
fulfilledAt: timestamp("fulfilled_at"),
```

Nullable (no `.notNull()`). No default. Drizzle's `timestamp` returns `Date | null` on read.

Migration generated via `npm run db:generate` and applied via `npm run db:migrate`. The migration is a single `ALTER TABLE orders ADD COLUMN fulfilled_at TIMESTAMP NULL;` — safe on production with no backfill needed (existing rows get NULL, which correctly represents "not yet fulfilled").

## API: `POST /api/admin/orders/[id]/fulfill`

**File:** `app/api/admin/orders/[id]/fulfill/route.ts`

**Behavior:**
- Validates the admin JWT using existing `validateAdminToken` from `lib/auth.ts`. Returns 401 on failure.
- Parses `id` from `params` (Promise-unwrapped) as a number; returns 400 on invalid id.
- Parses JSON body. Expects `{ fulfilled: boolean }`. Returns 400 if the body is missing or `fulfilled` is not a boolean.
- Executes a Drizzle `update`:
  - `fulfilled === true` → `fulfilled_at = new Date()` (server clock, not client-supplied).
  - `fulfilled === false` → `fulfilled_at = null`.
- Returns the updated row as JSON. 404 if the order id does not exist.

**Why explicit boolean instead of a pure toggle:** two admin tabs might click simultaneously; with a toggle endpoint they could ping-pong unpredictably. With an explicit desired state, the final value is whichever request arrives last, which is deterministic and intuitive.

## UI Changes (`app/admin/orders/page.tsx`)

### `Order` interface

Add one field:
```ts
fulfilledAt: string | null;
```

(JSON serialization of `Date | null` from the API response is `string | null`.)

### Filter dropdown

A `<select>` next to the "Orders" heading. New state:
```ts
const [filter, setFilter] = useState<"all" | "unfulfilled" | "fulfilled">("all");
```

Options (in this order):
- All
- Unfulfilled
- Fulfilled

The orders array is filtered before render:
```ts
const filteredOrders = orders.filter((o) => {
  if (filter === "fulfilled") return o.fulfilledAt !== null;
  if (filter === "unfulfilled") return o.fulfilledAt === null;
  return true;
});
```

The `.map` over orders is replaced with `.map` over `filteredOrders`.

Styling reuses the existing rounded-pill input style used elsewhere on the admin pages (`border border-[var(--candy-border)] rounded-[14px] py-2 px-3 bg-white text-sm`).

The heading row becomes:
```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-black">Orders</h1>
  <select ...>...</select>
</div>
```

(Matches the existing pattern in `app/admin/products/page.tsx` for the heading + action row.)

### "Fulfilled" badge on the collapsed card

Rendered next to the customer name in the card summary header, only when `order.fulfilledAt !== null`:

```tsx
{order.fulfilledAt && (
  <span className="ml-2 inline-block bg-[var(--candy-green-bg)] text-[#065F46] text-xs font-bold rounded-full py-0.5 px-2">
    Fulfilled
  </span>
)}
```

Placed inside the existing `<div className="font-bold text-sm">{order.customerFirstName} {order.customerLastName}</div>` after the name.

### Fulfillment toggle button

Added to the action row inside the expanded panel, as a third sibling to Print and Download. The action row currently is:

```tsx
<div className="flex gap-2 mb-3">
  <button>Print</button>
  <button>Download PDF</button>
</div>
```

After this spec:

```tsx
<div className="flex gap-2 mb-3 flex-wrap">
  <button>Print</button>
  <button>Download PDF</button>
  <button>{fulfilled-aware label}</button>
</div>
```

(`flex-wrap` added so on narrow mobile widths the buttons wrap to a second row rather than overflow.)

**When `order.fulfilledAt === null` (unfulfilled):**
```tsx
<button
  onClick={(e) => { e.stopPropagation(); toggleFulfilled(order); }}
  className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] text-xs font-bold hover:bg-[rgba(52,211,153,0.28)] transition-colors"
>
  <CheckCircle className="size-3.5" /> Mark Fulfilled
</button>
```

**When `order.fulfilledAt` is set (fulfilled):**
```tsx
<button
  onClick={(e) => { e.stopPropagation(); toggleFulfilled(order); }}
  className="flex items-center gap-1.5 rounded-2xl py-1.5 px-3 bg-[#F1F5F9] border border-[var(--candy-border)] text-[var(--candy-muted)] text-xs font-bold hover:bg-[#E2E8F0] transition-colors"
>
  <Check className="size-3.5" /> Fulfilled (click to undo)
</button>
```

Icons: `CheckCircle` (unfulfilled-state button) and `Check` (fulfilled-state button), both from `lucide-react` — adds two imports to the top of the file.

### Toggle handler

```ts
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
    // Revert
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, fulfilledAt: order.fulfilledAt } : o
      )
    );
    alert("Failed to update fulfillment status.");
  }
}
```

The client-supplied optimistic timestamp may differ from the server-stored value by milliseconds. This is intentional and harmless: the UI only checks `fulfilledAt !== null`, never displays the value.

## Error Handling

| Path | Behavior |
| --- | --- |
| Network failure | Revert optimistic UI update; alert "Failed to update fulfillment status." |
| Non-2xx HTTP response (401, 404, 500) | Same as network failure |
| Two admin tabs flip the same order simultaneously | Server applies whichever request arrives last. Both tabs' optimistic updates may briefly disagree until the next page refresh. Acceptable — admin tool, single-user typical use. |
| Invalid JSON body posted to the API | API returns 400. Client treats as a generic failure (revert + alert). |

## Testing

Manual only — matches project convention.

- Mark an unfulfilled order as fulfilled → button label changes, badge appears on the collapsed row, refresh page and confirm both persist.
- Click "Fulfilled (click to undo)" → button reverts, badge disappears, refresh and confirm.
- Toggle the filter through All / Unfulfilled / Fulfilled → confirm correct subsets shown.
- DevTools → Network → set offline → click button → confirm UI reverts and alert appears.
- `curl` the new endpoint without a token → confirm 401.
- `curl` with a valid token, invalid body (`{}`) → confirm 400.

## Open Questions

None.

## Out of Scope (Future)

- Multi-state order lifecycle (preparing / shipped / cancelled).
- User attribution on fulfillment (who marked it).
- Surfacing the fulfillment timestamp in the UI.
- Bulk fulfill.
- Filter persistence (`localStorage`).
- Customer notification email on fulfillment.
- Sort by fulfillment status (current sort is implicit by `createdAt` desc from the API).
