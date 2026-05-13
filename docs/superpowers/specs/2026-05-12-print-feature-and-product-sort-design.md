# Admin Invoice Print/PDF & Product List Sort — Design

**Date:** 2026-05-12
**Status:** Approved

## Goal

Two admin-page improvements:

1. **Invoice print / PDF download for orders.** From the admin orders page, the user can print a saved order as a US Letter business invoice, or download it as a PDF. The invoice is a customer-facing document (business header, "Bill To" customer block, itemized table with prices, grand total, optional notes, "Thank you" footer).
2. **Sort control on the admin products list.** The page already filters by name/UPC via a search box. Add a sort dropdown with three options: Alphabetical (A–Z, by name), UPC, Category. Default Alphabetical, ascending only (no asc/desc toggle).

Both features are admin-only and bundled into one spec because each is small and they share the same surface area.

## Non-Goals

- Batch printing or batch PDF download of multiple orders.
- Server-side PDF generation (no puppeteer/playwright on Netlify Functions).
- Vector/selectable text in the PDF — the PDF will be produced by rasterizing the printed invoice DOM via `html2pdf.js`. Fidelity is sufficient for an admin invoice; if true vector PDFs are needed later, the invoice route layout can be reused with `@react-pdf/renderer` or headless-Chromium without changing the user-facing flow.
- Asc/desc sort toggle. Single direction (ascending) only.
- Persisting the sort selection across reloads.
- Product image thumbnails on the printed invoice (per user choice during brainstorming).
- Emailing the invoice PDF to the customer.
- Adding business contact info (address/phone/email) to the invoice header — name and footer only for now.

## Architecture Overview

Three groups of changes:

1. **New invoice route** at `app/admin/orders/[id]/invoice/page.tsx` (server component) that fetches the order from `ordersTable` by ID and renders a print-styled US Letter invoice. A small client-component child (`InvoiceClient.tsx`) handles `?print=1` (auto-call `window.print()`) and `?download=1` (auto-run `html2pdf.js`).
2. **Buttons on the admin orders page** — two buttons inside each expanded order panel: **Print** opens the invoice route with `?print=1` in a new tab; **Download PDF** opens it with `?download=1` in a new tab.
3. **Sort dropdown on the admin products page** — a `<select>` next to the existing search input. Sort applied client-side after the existing name/UPC filter, before render.

New dependency: `html2pdf.js` (~30 KB, MIT). Loaded via dynamic `import("html2pdf.js")` inside the client component so it does not enter the server bundle.

New tiny config module: `lib/invoice-config.ts` — exports `BUSINESS_NAME` and `INVOICE_FOOTER`. Single edit point for branding.

No schema changes. No new API routes. No new server dependencies.

## Feature 1 — Invoice Print / PDF Download

### Route: `app/admin/orders/[id]/invoice/page.tsx`

- Server component, no `"use client"`.
- Fetches the order by ID using the existing Drizzle client in `lib/db/index.ts`:
  ```ts
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, Number(params.id)))
    .limit(1);
  ```
- If `order` is undefined → renders `<p>Order not found.</p>` and exits.
- Parses `order.items` (JSON-stringified array of `OrderItem`) into typed items.
- Auth: the existing `app/admin/layout.tsx` already gates `/admin/*`. The new nested route inherits this. Verify during implementation that the layout actually wraps `[id]/invoice` (it should, since App Router layouts apply to all descendants).

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ Candy & More Wholesale                       INVOICE     │
│                                              #00042      │
│                                              May 12, 2026│
├──────────────────────────────────────────────────────────┤
│ Bill To:                                                 │
│   John Doe                                               │
│   john@example.com         (optional, hidden if null)   │
│   (555) 123-4567           (optional, hidden if null)   │
│   123 Main St, Brooklyn NY (optional, hidden if null)   │
├──────────────────────────────────────────────────────────┤
│ Product            UPC           Qty   Unit    Subtotal  │
│ ─────────────────────────────────────────────────────── │
│ Sour Patch Kids    012345678905   12   $1.99   $23.88   │
│ ...                                                      │
├──────────────────────────────────────────────────────────┤
│                                       TOTAL    $37.38   │
├──────────────────────────────────────────────────────────┤
│ Notes:                                                   │
│   Customer wants delivery before Friday.                 │
│   (entire section hidden when order.note is null)        │
├──────────────────────────────────────────────────────────┤
│              Thank you for your business!                │
└──────────────────────────────────────────────────────────┘
```

- Order ID rendered as `#` followed by `order.id.toString().padStart(5, "0")` (so `#00042`).
- Date: `submittedAt` formatted as long-form (`toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })`).
- Item rows: name, UPC (monospaced), quantity (centered), unit price (`$X.XX`), subtotal (`$X.XX`).
- Total: right-aligned, bold, derived as the sum of `item.price * item.quantity` — sanity-checked against `order.totalPrice` from the DB at render time (use the DB value as canonical; computed value is only for the per-row subtotals).
- Footer text comes from `INVOICE_FOOTER` in `lib/invoice-config.ts`.

### Screen vs print styles

- **Screen view** (admin previewing in browser): invoice rendered on a centered white card with a light gray surrounding background — looks like a document preview.
- **Print view** (`@media print`):
  - `@page { size: letter; margin: 0.5in; }`
  - Background-gray and any padding wrappers reset; invoice fills the page within the `@page` margin.
  - Everything outside the invoice container hidden via `@media print { body > *:not(#invoice-root) { display: none; } }`. The invoice page's root element is `<div id="invoice-root">`. Because this route is nested under the admin layout, any sidebar/nav rendered by the layout is hidden by this selector during print.
  - Verify during implementation that the admin layout's sidebar is hidden in the print view — if the selector above is insufficient, add explicit `@media print { .admin-sidebar { display: none; } }`.

### Client-side actions (`InvoiceClient.tsx`)

Imported into the server page as a child component. Reads `searchParams` (via the `useSearchParams` hook from `next/navigation`):

- `?print=1` → on mount, call `window.print()`. Browser print dialog opens; user can print to paper or "Save as PDF" from the dialog.
- `?download=1` → on mount, dynamically `import("html2pdf.js")`, then call it against `document.getElementById("invoice-root")` with options `{ filename: invoice-{id}.pdf, jsPDF: { format: "letter" } }`, then trigger download. If `html2pdf.js` throws, show `alert("PDF generation failed. Use the Print button and choose 'Save as PDF' from the print dialog.")` and leave the tab open.
- No query param → render only, no side-effect (lets the admin preview the invoice via the URL directly).

### Buttons on `app/admin/orders/page.tsx`

In the existing expanded order panel (inside `{isExpanded && (...)}`), above the desktop items table, add a small action row:

```tsx
<div className="flex gap-2 mb-3">
  <button onClick={() => window.open(`/admin/orders/${order.id}/invoice?print=1`, "_blank")}>
    <Printer className="size-3.5" /> Print
  </button>
  <button onClick={() => window.open(`/admin/orders/${order.id}/invoice?download=1`, "_blank")}>
    <Download className="size-3.5" /> Download PDF
  </button>
</div>
```

Both buttons styled to match the page's existing rounded button pattern (small, neutral background, dark text). Icons from `lucide-react` (`Printer`, `Download`) — already a project dep.

Opening in a new tab keeps the orders page state (expanded panel, scroll position) intact and gives the user a recoverable preview tab if anything goes wrong.

### Config: `lib/invoice-config.ts`

```ts
export const BUSINESS_NAME = "Candy & More Wholesale";
export const INVOICE_FOOTER = "Thank you for your business!";
```

Single edit point — the invoice route imports both.

## Feature 2 — Product List Sort

### Edit only: `app/admin/products/page.tsx`

- Add state: `const [sortBy, setSortBy] = useState<"name" | "upc" | "category">("name");`
- Render a `<select>` next to the existing search input. Mobile: it stacks below the search via the page's existing responsive utilities.
- Sort options:
  - `name` → label "Alphabetical (A–Z)"
  - `upc` → label "UPC"
  - `category` → label "Category"
- Sort logic, applied after the existing search filter:
  ```ts
  const filteredSorted = [...filtered].sort((a, b) => {
    if (sortBy === "upc") return a.upc.localeCompare(b.upc);
    if (sortBy === "category") return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
  ```
- Replace references to the existing `filtered` derived array with `filteredSorted` (computed from `filtered`) in both the desktop table and mobile card render paths.
- No persistence (resets on reload). Matches the project's "client-side only" cart pattern from `CLAUDE.md`.

## Error Handling

| Path | Behavior |
| --- | --- |
| Invoice route, invalid/missing ID | Render `<p>Order not found.</p>`. No 404 needed (admin-only). |
| Invoice route, DB read fails | Let Next.js error boundary handle it (`error.tsx` if present, otherwise default error UI). |
| `html2pdf.js` import/render fails | `alert()` with fallback instruction to use Print → Save as PDF. Tab stays open. |
| Sort on products page | No error path (in-memory sort over already-loaded array). |

## Testing

Manual only — matches project convention (no test files in repo currently).

**Invoice:**
- Print a real order from the admin orders page; confirm sidebar is hidden in the print preview, layout fits one US Letter page for typical 5–10-item orders.
- Download PDF; confirm filename is `invoice-{id}.pdf` and content matches the print view.
- Submit a brand-new order with only `customerEmail` set (no phone, no store address); confirm the customer block hides the null fields and the Notes section is absent.
- Submit an order with a long `note`; confirm the Notes section renders.

**Sort:**
- Toggle each of the three sort options; confirm both the desktop table and mobile card list re-order.
- Combine search + sort; confirm sort applies to the filtered subset.

## Open Questions

None — all clarifications resolved during brainstorming.

## Out of Scope (Future)

- Asc/desc sort toggle.
- Persisting sort selection (e.g., to `localStorage`).
- Vector-text PDFs.
- Batch print/download.
- Invoice business contact line (address/phone/email).
- Product thumbnails on the invoice.
- Emailing the invoice PDF to the customer at order time.
