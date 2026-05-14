# Invoice Product Images — Design

**Date:** 2026-05-12
**Status:** Approved

## Goal

Show a 40px product thumbnail to the left of each item name on the printable invoice (`/admin/orders/[id]/invoice`). Mirrors how items are rendered on the admin orders page today. Applies to all three views of the invoice: on-screen preview, browser print dialog, and `?download=1` PDF generation.

## Context

The original invoice spec (`2026-04-11-print-feature-and-product-sort-design.md`) intentionally excluded product thumbnails per the user's choice during brainstorming (option C "Full business invoice, no photos" was selected over option D which included photos). This spec reverses that decision: photos are now in scope.

## Non-Goals

- No new API routes. Reuses the existing `GET /api/admin/products` (auth-gated) for the photo map and `GET /api/images/[productId]` for the actual image bytes.
- No image upload, resizing, or format conversion. Uses whatever `photoUrl` the products list already returns.
- No fallback to product-list re-fetch on cache miss. One-shot fetch at invoice load.
- No layout change beyond the items table. Header, bill-to, total, notes, and footer remain identical.

## Architecture Overview

Two files change:

1. **`app/admin/orders/[id]/invoice/page.tsx`** — add a second parallel `fetch("/api/admin/products")` alongside the existing single-order fetch. Build a `photoByProductId: Record<string, string>` map. Gate the page render and the print/download side-effect on BOTH the order and the products having loaded. In the items-table row, replace the bare product-name cell with a flex container containing thumbnail + name.

2. **`app/admin/orders/[id]/invoice/invoice.css`** — add three classes for thumbnail styling: `.invoice-product-cell` (flex layout), `.invoice-thumb` (40×40 image), `.invoice-thumb-placeholder` (neutral gray div of same dimensions).

No API routes change. No schema change. No other files touched.

## Data Flow

Current data flow (before this spec):
- `useEffect` fetches `/api/admin/orders/${id}` once.
- When order arrives, render the page.
- Second `useEffect` watches `order` and `searchParams`. When order loaded and `?print=1` or `?download=1` is set, fires the trigger.

New data flow (after this spec):
- `useEffect` fires TWO parallel fetches via `Promise.all`:
  - `GET /api/admin/orders/${id}` — single order, auth-gated.
  - `GET /api/admin/products` — list of products, auth-gated.
- Both responses are awaited. Order goes into `order` state. Products list is transformed into `photoByProductId: Record<string, string>` keyed by product id.
- A new boolean `productsLoaded` (or a non-null `photoByProductId` value) gates the render.
- Print/download side-effect changes its guard from `if (!order)` to `if (!order || !productsLoaded)` so that html2pdf and `window.print()` never run before images can resolve.
- Image URLs in the rendered HTML point at the existing `/api/images/[productId]` route (or whatever `photoUrl` from the products list says — same as the orders page convention).

## UI Change — Items Table

### Before

```tsx
<td className="col-product">{item.name}</td>
```

### After

```tsx
<td className="col-product">
  <div className="invoice-product-cell">
    {photoByProductId[item.productId] && photoByProductId[item.productId] !== "MISSING" ? (
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

The `"MISSING"` sentinel is the same one used by the on-screen orders page and the catalog — products without an uploaded image have `photoUrl: "MISSING"` in the DB (per the schema's default).

### Styling — `invoice.css` additions

Appended to the existing stylesheet:

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

Both the `<img>` and the placeholder `<div>` get `.invoice-thumb`, so they share the same box dimensions and border. The placeholder additionally gets `.invoice-thumb-placeholder` for the neutral gray fill.

No `@media print` overrides — the thumbnail looks the same on screen and in print.

## Loading and Triggers

### `productsLoaded` guard

Add a parallel state flag (the cleanest way is to allow the map state to be `null` initially):

```tsx
const [photoByProductId, setPhotoByProductId] = useState<Record<string, string> | null>(null);
```

Loading state check changes to:

```tsx
if (!order || !photoByProductId) {
  return <p style={{ padding: "2rem", textAlign: "center" }}>Loading…</p>;
}
```

Print/download `useEffect` dependency stays `[order, searchParams]` but the early guard becomes:

```tsx
if (!order || !photoByProductId) return;
```

(Or include `photoByProductId` in the dependency array — but adding it would re-trigger the effect once products land, which is exactly what we want for the initial mount. So the guard alone is fine if we keep the existing deps, or we can list `photoByProductId` explicitly to be more correct. We will explicitly list it.)

### Parallel fetch

The existing single-fetch `useEffect` is replaced with:

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
        // If products fail, render anyway with placeholder squares.
        setPhotoByProductId({});
      }
    })
    .catch(() => setError("Failed to load order."));
}, [id]);
```

If the products fetch fails (rare — same auth as the order fetch), the invoice still renders with all placeholders. This is a graceful degradation, not an error path.

## Error Handling

| Path | Behavior |
| --- | --- |
| Order 404 / network failure | Same as today — `"Order not found."` or `"Failed to load order."` message. |
| Products fetch fails (any reason) | Set `photoByProductId` to `{}`. All items render with placeholder squares. No error shown. |
| Individual product missing from map (e.g., product was deleted after the order was placed) | The `photoByProductId[item.productId]` lookup returns undefined → falls into the placeholder branch. |
| `photoUrl === "MISSING"` | Falls into the placeholder branch. |
| Image fails to load at the browser level | Browser shows broken image icon. Acceptable for an admin tool; not worth wiring an `onError` fallback. |

## PDF Generation Compatibility

html2pdf.js calls html2canvas internally to rasterize the DOM. The existing `?download=1` handler already passes `html2canvas: { scale: 2, useCORS: true }`. Same-origin images don't need CORS but `useCORS: true` is harmless and future-proofs us if images ever move to a CDN.

html2canvas waits for `<img>` elements to fire `load` before rasterizing. Since the new guard prevents the download trigger from firing until `photoByProductId` is non-null (meaning the products list has resolved and the URLs are in the DOM), the worst case is the user waits an extra second or two for image bytes to arrive. No functional breakage.

The 300ms print delay (`setTimeout(() => window.print(), 300)`) gives the browser the same window for image paint before the print dialog opens. On slow image loads this could result in the print preview missing images — acceptable for an admin tool, and the user can re-print. If this becomes a real problem, a future enhancement can wait for image load events explicitly before triggering print.

## Testing

Manual only — matches project convention.

- Visit `/admin/orders/<id>/invoice` for an order whose items include a mix of products with and without uploaded images. Confirm thumbnails appear left of the name for products that have an image, and neutral gray placeholders for products that don't.
- Click "Print" on an order — confirm thumbnails render in the print preview.
- Click "Download PDF" — confirm the saved PDF includes the thumbnails.
- Block `/api/admin/products` in DevTools → reload the invoice → confirm all items show placeholder squares (graceful degradation), invoice still usable.
- Visit `/admin/orders/<id>/invoice` for an order where one item has a `productId` that no longer exists in the products list (deleted product) — confirm placeholder square renders for that item.

## Open Questions

None.

## Out of Scope (Future)

- Image lazy loading.
- A "no images" view toggle on the print page.
- Inlining image bytes as base64 to avoid the HTTP round-trip during print (currently each image is one extra request; on a typical order with ~10 items this is ten requests, all cached after the first invoice).
- Resizing thumbnails for smaller PDF file size.
- Configurable thumbnail size.
