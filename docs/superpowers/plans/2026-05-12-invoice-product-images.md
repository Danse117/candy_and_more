# Invoice Product Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a 40px product thumbnail to the left of each item name in the printable invoice route (`/admin/orders/[id]/invoice`), mirroring the on-screen admin orders page.

**Architecture:** Add a parallel `GET /api/admin/products` fetch alongside the existing single-order fetch in the invoice page client component. Build a `photoByProductId` map. Gate the loading screen and the print/download side-effect on both fetches resolving. Add three CSS classes to style the thumbnail + placeholder square. Sentinel `photoUrl === "MISSING"` triggers the placeholder branch.

**Tech Stack:** Next.js 16 client component, React 19 `useState` + `useEffect`, existing auth-gated admin API endpoints, plain CSS in `invoice.css`.

**Incidental fix:** The existing `fetch("/api/admin/orders/${id}")` call in this file is missing an `Authorization: Bearer <nf_token>` header — currently latent 401 bug that breaks the Print/Download flow against the live API. The new parallel-fetch wiring fixes it.

**Project convention note:** No automated test suite. Each task uses manual verification — lint, file inspection, and (for Task 3) a build + walkthrough.

---

## File Structure

**Modified:**
- `app/admin/orders/[id]/invoice/page.tsx` — add `photoByProductId` state; replace single-order fetch with parallel fetch (with auth); update loading guard and print/download guard; update items-table Product column cell.
- `app/admin/orders/[id]/invoice/invoice.css` — append three classes: `.invoice-product-cell`, `.invoice-thumb`, `.invoice-thumb-placeholder`.

No new files. No API routes. No schema.

---

## Task 1: Add thumbnail CSS classes

**Files:**
- Modify: `app/admin/orders/[id]/invoice/invoice.css`

- [ ] **Step 1: Append the new classes**

Open `app/admin/orders/[id]/invoice/invoice.css`. The file currently ends with the `@media print { ... }` block. Append these classes AFTER the `@media print` block (at the end of the file):

```css

.invoice-product-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.invoice-thumb {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #E2E8F0;
  flex-shrink: 0;
}

.invoice-thumb-placeholder {
  background: #F1F5F9;
}
```

(Leading blank line for separation from the `@media print` block.)

The placeholder and the `<img>` will both get `.invoice-thumb` for shared box dimensions; the placeholder gets the extra `.invoice-thumb-placeholder` for the neutral fill.

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: no NEW errors. (CSS files don't get linted by ESLint, so this just confirms the page.tsx wasn't accidentally touched.)

- [ ] **Step 3: Commit**

```bash
git add 'app/admin/orders/[id]/invoice/invoice.css'
git commit -m "feat(invoice): add thumbnail styles"
```

The new classes are unused after this commit — they will be consumed in Task 2. This is intentional: separating CSS from JS commits keeps each change tightly scoped.

---

## Task 2: Wire up parallel fetch + thumbnail rendering

**Files:**
- Modify: `app/admin/orders/[id]/invoice/page.tsx`

This task has four logical edits in the same file. Apply each in sequence.

- [ ] **Step 1: Add `photoByProductId` state and update existing fetch**

Open `app/admin/orders/[id]/invoice/page.tsx`. Locate the existing state declarations (around lines 36-37):

```tsx
const [order, setOrder] = useState<Order | null>(null);
const [error, setError] = useState<string | null>(null);
```

Insert a new state declaration immediately after `setError`:

```tsx
const [photoByProductId, setPhotoByProductId] = useState<Record<string, string> | null>(null);
```

The three state lines should now be:
```tsx
const [order, setOrder] = useState<Order | null>(null);
const [error, setError] = useState<string | null>(null);
const [photoByProductId, setPhotoByProductId] = useState<Record<string, string> | null>(null);
```

- [ ] **Step 2: Replace the fetch `useEffect` with parallel-fetch + auth**

Locate the first `useEffect` (currently lines 40-52):

```tsx
useEffect(() => {
  fetch(`/api/admin/orders/${id}`)
    .then(async (r) => {
      if (r.ok) {
        setOrder(await r.json());
      } else if (r.status === 404) {
        setError("Order not found.");
      } else {
        setError("Failed to load order.");
      }
    })
    .catch(() => setError("Failed to load order."));
}, [id]);
```

Replace the ENTIRE `useEffect` block with:

```tsx
useEffect(() => {
  const token = sessionStorage.getItem("nf_token");
  const headers = { Authorization: `Bearer ${token}` };
  Promise.all([
    fetch(`/api/admin/orders/${id}`, { headers }),
    fetch("/api/admin/products", { headers }),
  ])
    .then(async ([orderRes, productsRes]) => {
      if (orderRes.ok) {
        setOrder(await orderRes.json());
      } else if (orderRes.status === 404) {
        setError("Order not found.");
      } else {
        setError("Failed to load order.");
      }
      if (productsRes.ok) {
        const products = (await productsRes.json()) as Array<{
          id: string;
          photoUrl: string;
        }>;
        const map: Record<string, string> = {};
        for (const p of products) map[p.id] = p.photoUrl;
        setPhotoByProductId(map);
      } else {
        // Graceful degradation: render all placeholders if products fail.
        setPhotoByProductId({});
      }
    })
    .catch(() => setError("Failed to load order."));
}, [id]);
```

Key changes:
- Adds the `Authorization: Bearer <token>` header (this is also the incidental fix for the previously-broken Print/Download against the live API).
- Adds the `/api/admin/products` parallel fetch.
- Sets `photoByProductId` to a map keyed by product id; falls back to `{}` if the products fetch fails so the page still renders.

- [ ] **Step 3: Update loading guard and print/download trigger guard**

Locate the loading guard (currently lines 102-104):

```tsx
if (!order) {
  return <p style={{ padding: "2rem", textAlign: "center" }}>Loading…</p>;
}
```

Change to:

```tsx
if (!order || !photoByProductId) {
  return <p style={{ padding: "2rem", textAlign: "center" }}>Loading…</p>;
}
```

Now locate the second `useEffect`'s opening guard (currently around line 55):

```tsx
useEffect(() => {
  if (!order) return;
```

Change to:

```tsx
useEffect(() => {
  if (!order || !photoByProductId) return;
```

And update that same `useEffect`'s dependency array (currently line 97):

```tsx
}, [order, searchParams]);
```

Change to:

```tsx
}, [order, photoByProductId, searchParams]);
```

This ensures the print/download trigger fires when BOTH the order and the product photo map have resolved.

- [ ] **Step 4: Update items table Product cell**

Locate the items-table tbody (currently lines 156-168):

```tsx
<tbody>
  {items.map((item, i) => (
    <tr key={i}>
      <td className="col-product">{item.name}</td>
      <td className="col-upc">{item.upc}</td>
      <td className="col-qty">{item.quantity}</td>
      <td className="col-unit">${Number(item.price).toFixed(2)}</td>
      <td className="col-subtotal">
        ${(Number(item.price) * item.quantity).toFixed(2)}
      </td>
    </tr>
  ))}
</tbody>
```

Change ONLY the Product `<td>` (the first column). Replace:

```tsx
<td className="col-product">{item.name}</td>
```

with:

```tsx
<td className="col-product">
  <div className="invoice-product-cell">
    {photoByProductId[item.productId] && photoByProductId[item.productId] !== "MISSING" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoByProductId[item.productId]}
        alt={item.name}
        className="invoice-thumb"
      />
    ) : (
      <div className="invoice-thumb invoice-thumb-placeholder" aria-hidden="true" />
    )}
    <span>{item.name}</span>
  </div>
</td>
```

The `// eslint-disable-next-line @next/next/no-img-element` is required because the project lints `@next/next/no-img-element` and we're using a raw `<img>` (Next's `<Image>` doesn't work cleanly inside html2canvas/html2pdf rasterization). This matches the pattern used elsewhere in the admin pages (e.g., `app/admin/orders/page.tsx`, `app/admin/products/page.tsx`).

- [ ] **Step 5: Verify lint**

Run: `npm run lint`
Expected: no NEW errors. The pre-existing 2 errors in `app/admin/layout.tsx` and the 2 `<img>` warnings elsewhere are unchanged. The new `<img>` in this file gets the inline ESLint suppression so it should NOT add a third warning.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds, all routes appear in the output. (Catches TypeScript errors that lint alone might miss.)

If `npm run build` fails with a type error citing `photoByProductId`, double-check the type annotation in Step 1.

- [ ] **Step 7: Commit**

```bash
git add 'app/admin/orders/[id]/invoice/page.tsx'
git commit -m "feat(invoice): render product thumbnails in items table"
```

---

## Task 3: End-to-end manual verification

**Files:** None — verification only.

- [ ] **Step 1: Start the dev server**

The dev server may already be running (from earlier tasks). If not, start it:

For the data layer to work end-to-end, use `netlify dev` (NOT `npm run dev` — the latter returns 500 because `@netlify/neon` needs the Netlify dev proxy).

```bash
netlify dev
```

Wait for the "Ready" output.

- [ ] **Step 2: Visit the invoice route directly**

In the browser, log into the admin dashboard. Then visit `http://localhost:8888/admin/orders/<id>/invoice` (substitute a real order id from the admin orders page).

(Note: Netlify dev runs on port 8888 by default; if the dev server you started is on a different port, use that. `npm run dev` uses port 3000.)

Expected:
- Page renders without the admin sidebar.
- For order items whose product has an uploaded image, a 40px thumbnail appears to the left of the item name with a thin border and rounded corners.
- For order items whose product has `photoUrl: "MISSING"` (or whose product no longer exists in the products table), a neutral gray placeholder square of the same size appears.
- The rest of the invoice (header, bill-to, total, footer) is unchanged.

- [ ] **Step 3: Print walkthrough**

From the admin orders page, expand an order and click **Print**. A new tab opens to the invoice route with `?print=1`. The page should:
- Show thumbnails left of item names (same as Step 2's preview).
- Auto-open the browser print dialog after ~300ms.
- The print preview should show the thumbnails alongside item names.

Cancel the print dialog.

- [ ] **Step 4: Download PDF walkthrough**

From the admin orders page, click **Download PDF** on the same order. A new tab opens, generates the PDF, and downloads `invoice-<id>.pdf`.

Open the PDF and confirm:
- Thumbnails appear in the items table, left of each name.
- Image quality is reasonable (html2canvas uses `scale: 2`, so thumbnails are rendered at 2× resolution).
- Placeholder squares (for items without images) appear as solid light-gray boxes.

- [ ] **Step 5: Graceful degradation check**

Open DevTools → Network tab. Right-click `/api/admin/products` and choose Block request URL. Reload the invoice page.

Expected:
- Page still renders.
- ALL items show the gray placeholder square (no thumbnails, since the products fetch was blocked).
- Items, prices, total all unchanged.

Un-block the URL.

- [ ] **Step 6: Final lint**

Run: `npm run lint`
Expected: same 4 pre-existing problems (2 errors in `app/admin/layout.tsx`, 2 `<img>` warnings in unrelated component files). No new ones from this feature.

- [ ] **Step 7: No commit needed** — verification only.
