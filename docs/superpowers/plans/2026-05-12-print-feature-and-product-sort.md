# Admin Invoice Print/PDF & Product List Sort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a US Letter business-invoice print + PDF download for each saved order on the admin orders page, and add a sort dropdown (Alphabetical / UPC / Category) to the admin products page.

**Architecture:**
- New client-component route at `/admin/orders/[id]/invoice` renders the invoice and reads `?print=1` / `?download=1` from the URL to auto-trigger `window.print()` or `html2pdf.js`. Order data is fetched via a new auth-gated `GET /api/admin/orders/[id]` endpoint.
- `app/admin/layout.tsx` gets a 2-line bypass so the invoice route renders without the sidebar/topbar chrome — keeping the admin auth check in place but giving the invoice a clean printable surface.
- Two new buttons in each expanded order panel on `app/admin/orders/page.tsx` open the invoice route in a new tab with the appropriate query param.
- The admin products page (`app/admin/products/page.tsx`) gets a sort `<select>` next to the existing search input.

**Tech Stack:** Next.js 16 App Router (client components), React 19, Drizzle ORM (`@netlify/neon`), Tailwind v4, `lucide-react` icons, new dependency `html2pdf.js` (~30 KB, MIT, client-only via dynamic import).

**Deviation from spec:** The spec proposed a server-component invoice route. Implementation switched to client component because the admin layout's auth is client-side (sessionStorage), so a server component would render HTML before auth runs and leak order data. Same user-facing behavior; cleaner auth model.

**Project convention note:** This codebase has no automated test suite. Each task uses **manual verification** instead of test-first. This matches existing patterns documented in the spec and `CLAUDE.md`.

---

## File Structure

**Created:**
- `lib/invoice-config.ts` — exports `BUSINESS_NAME` and `INVOICE_FOOTER` constants.
- `app/api/admin/orders/[id]/route.ts` — `GET` single order by ID with JWT auth.
- `app/admin/orders/[id]/invoice/page.tsx` — client component invoice route.
- `app/admin/orders/[id]/invoice/invoice.css` — `@page` and `@media print` rules + screen layout.

**Modified:**
- `app/admin/layout.tsx` — add invoice-route chrome bypass (~2 lines).
- `app/admin/orders/page.tsx` — add Print + Download buttons to expanded order panel.
- `app/admin/products/page.tsx` — add sort state, `<select>`, and apply sort to filtered list.
- `package.json` / `package-lock.json` — add `html2pdf.js` dependency.

---

## Task 1: Install html2pdf.js and create invoice config

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `lib/invoice-config.ts`

- [ ] **Step 1: Install the dependency**

Run:
```bash
npm install html2pdf.js@^0.10
```
Expected: package added, no errors. Verify `package.json` now has `"html2pdf.js": "^0.10..."` in `dependencies`.

- [ ] **Step 2: Create `lib/invoice-config.ts`**

Create file with exact contents:
```ts
export const BUSINESS_NAME = "Candy & More Wholesale";
export const INVOICE_FOOTER = "Thank you for your business!";
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/invoice-config.ts
git commit -m "chore: add html2pdf.js dep and invoice config module"
```

---

## Task 2: Add `GET /api/admin/orders/[id]` route

**Files:**
- Create: `app/api/admin/orders/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/admin/orders/[id]/route.ts` with exact contents:
```ts
import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
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

  const db = getDb();
  const rows = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}
```

(Note: `params` is a Promise in Next.js 16 — the `await params` pattern matches the project's existing Next 16 conventions documented in `AGENTS.md`.)

- [ ] **Step 2: Manual verification**

Start dev server: `npm run dev`. From the admin orders page in the browser, copy your `nf_token` from sessionStorage (DevTools → Application → Session Storage). Then in another terminal:
```bash
curl -H "Authorization: Bearer <paste-token>" http://localhost:3000/api/admin/orders/1
```
Expected: JSON body of order 1 (or `404 Not found` if no order with id 1 exists — then try a valid id from the admin orders page).

Also verify auth: `curl http://localhost:3000/api/admin/orders/1` (no header) → 401.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/orders/\[id\]/route.ts
git commit -m "feat: add GET /api/admin/orders/[id] for single-order fetch"
```

---

## Task 3: Bypass admin chrome for invoice route

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add the invoice-route check**

In `app/admin/layout.tsx`, locate the `isPublicRoute` definition (currently lines 14-15):
```tsx
const isPublicRoute =
  pathname === "/admin/login" || pathname === "/admin/recover";
```

Immediately after it, add:
```tsx
const isInvoiceRoute = /^\/admin\/orders\/\d+\/invoice$/.test(pathname);
```

Then locate the early-return block (currently lines 38-39):
```tsx
if (isPublicRoute) return <>{children}</>;
if (!authenticated) return null;
```

Change it to:
```tsx
if (isPublicRoute) return <>{children}</>;
if (!authenticated) return null;
if (isInvoiceRoute) return <>{children}</>;
```

The order matters: auth still runs (the `useEffect` and `authenticated` check happen before this), and only authenticated users reach the invoice render. The new line just strips the sidebar/topbar chrome from the invoice route.

- [ ] **Step 2: Manual verification (deferred)**

Cannot fully verify until Task 4 renders something at the invoice route. Skip explicit verification here — Task 4's verification covers this.

- [ ] **Step 3: Verify build/lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat: bypass admin chrome on invoice route"
```

---

## Task 4: Create invoice route — fetch and render layout (no print wiring yet)

**Files:**
- Create: `app/admin/orders/[id]/invoice/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/admin/orders/[id]/invoice/page.tsx` with exact contents:
```tsx
"use client";

import { useEffect, useState, use } from "react";
import { BUSINESS_NAME, INVOICE_FOOTER } from "@/lib/invoice-config";
import "./invoice.css";

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
}

interface OrderItem {
  productId: string;
  name: string;
  upc: string;
  quantity: number;
  price: number;
}

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    fetch(`/api/admin/orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (r) => {
      if (r.ok) {
        setOrder(await r.json());
      } else if (r.status === 404) {
        setError("Order not found.");
      } else {
        setError("Failed to load order.");
      }
    }).catch(() => setError("Failed to load order."));
  }, [id]);

  if (error) {
    return <p style={{ padding: "2rem", textAlign: "center" }}>{error}</p>;
  }
  if (!order) {
    return <p style={{ padding: "2rem", textAlign: "center" }}>Loading…</p>;
  }

  let items: OrderItem[] = [];
  try {
    items = JSON.parse(order.items);
  } catch {
    items = [];
  }

  const orderNumber = `#${String(order.id).padStart(5, "0")}`;
  const submittedDate = new Date(order.submittedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const grandTotal = Number(order.totalPrice).toFixed(2);

  return (
    <div id="invoice-screen-wrap">
      <div id="invoice-root">
        {/* Header */}
        <header className="invoice-header">
          <h1 className="invoice-business">{BUSINESS_NAME}</h1>
          <div className="invoice-meta">
            <div className="invoice-title">INVOICE</div>
            <div className="invoice-number">{orderNumber}</div>
            <div className="invoice-date">{submittedDate}</div>
          </div>
        </header>

        {/* Bill To */}
        <section className="invoice-billto">
          <h2>Bill To:</h2>
          <div className="invoice-customer-name">
            {order.customerFirstName} {order.customerLastName}
          </div>
          {order.customerEmail && <div>{order.customerEmail}</div>}
          {order.customerPhone && <div>{order.customerPhone}</div>}
          {order.storeAddress && <div>{order.storeAddress}</div>}
        </section>

        {/* Items table */}
        <table className="invoice-items">
          <thead>
            <tr>
              <th className="col-product">Product</th>
              <th className="col-upc">UPC</th>
              <th className="col-qty">Qty</th>
              <th className="col-unit">Unit</th>
              <th className="col-subtotal">Subtotal</th>
            </tr>
          </thead>
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
        </table>

        {/* Total */}
        <div className="invoice-total">
          <span className="invoice-total-label">TOTAL</span>
          <span className="invoice-total-amount">${grandTotal}</span>
        </div>

        {/* Notes — only when present */}
        {order.note && (
          <section className="invoice-notes">
            <h2>Notes:</h2>
            <p>{order.note}</p>
          </section>
        )}

        {/* Footer */}
        <footer className="invoice-footer">{INVOICE_FOOTER}</footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create a stub stylesheet so the import resolves**

Create `app/admin/orders/[id]/invoice/invoice.css` as an empty file for now (Task 5 fills it in):
```css
/* Filled in by Task 5 */
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Log into the admin dashboard. Find an order ID from the orders page. Visit `http://localhost:3000/admin/orders/<id>/invoice`.

Expected:
- Sidebar/topbar are absent (admin layout bypass working).
- Page shows all invoice sections: business name, INVOICE / #NNNNN / date, Bill To block (with whichever optional contact fields are populated), items table, TOTAL line, Notes section (only if the order has a note), footer line.
- For an order with no email/phone/storeAddress, those rows are absent.
- For an order without a note, the Notes section is absent.

If anything is wrong, fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add app/admin/orders/\[id\]/invoice/page.tsx app/admin/orders/\[id\]/invoice/invoice.css
git commit -m "feat: invoice route renders order layout"
```

---

## Task 5: Add invoice screen + print styles

**Files:**
- Modify: `app/admin/orders/[id]/invoice/invoice.css`

- [ ] **Step 1: Replace `invoice.css` contents**

Open `app/admin/orders/[id]/invoice/invoice.css` and replace the placeholder with:
```css
@page {
  size: letter;
  margin: 0.5in;
}

/* Screen preview — centered "document" on a soft gray background */
#invoice-screen-wrap {
  min-height: 100vh;
  background: #F1F5F9;
  padding: 24px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #0F172A;
}

#invoice-root {
  max-width: 8.5in;
  margin: 0 auto;
  background: white;
  padding: 0.75in;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 0 0 1px #E2E8F0;
  font-size: 12pt;
  line-height: 1.4;
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #0F172A;
  padding-bottom: 16px;
  margin-bottom: 20px;
}

.invoice-business {
  font-size: 22pt;
  font-weight: 900;
  margin: 0;
}

.invoice-meta {
  text-align: right;
}

.invoice-title {
  font-size: 16pt;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.invoice-number {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12pt;
  margin-top: 4px;
}

.invoice-date {
  color: #475569;
  font-size: 11pt;
  margin-top: 2px;
}

.invoice-billto {
  margin-bottom: 24px;
}

.invoice-billto h2,
.invoice-notes h2 {
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
  margin: 0 0 6px;
}

.invoice-customer-name {
  font-weight: 700;
  font-size: 13pt;
}

.invoice-items {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.invoice-items th,
.invoice-items td {
  padding: 8px 6px;
  font-size: 11pt;
}

.invoice-items thead th {
  text-align: left;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 9pt;
  letter-spacing: 0.05em;
  color: #475569;
  border-bottom: 1.5px solid #0F172A;
}

.invoice-items tbody tr {
  border-bottom: 1px solid #E2E8F0;
}

.invoice-items .col-upc {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10pt;
  color: #475569;
}

.invoice-items .col-qty {
  text-align: center;
  width: 60px;
}

.invoice-items .col-unit,
.invoice-items .col-subtotal {
  text-align: right;
  width: 90px;
}

.invoice-items thead .col-qty {
  text-align: center;
}

.invoice-items thead .col-unit,
.invoice-items thead .col-subtotal {
  text-align: right;
}

.invoice-total {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 24px;
  border-top: 2px solid #0F172A;
  padding-top: 12px;
  margin-bottom: 24px;
}

.invoice-total-label {
  font-size: 12pt;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.invoice-total-amount {
  font-size: 16pt;
  font-weight: 900;
}

.invoice-notes {
  margin-bottom: 24px;
}

.invoice-notes p {
  margin: 0;
  white-space: pre-wrap;
}

.invoice-footer {
  text-align: center;
  color: #475569;
  font-size: 11pt;
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid #E2E8F0;
}

@media print {
  html,
  body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  #invoice-screen-wrap {
    background: white !important;
    padding: 0 !important;
    min-height: 0 !important;
  }

  #invoice-root {
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
  }

  /* Avoid awkward page breaks mid-row */
  .invoice-items tr {
    page-break-inside: avoid;
  }
}
```

- [ ] **Step 2: Manual verification (screen)**

Reload `http://localhost:3000/admin/orders/<id>/invoice` in the browser.

Expected:
- Invoice shows as a centered white "document" on a soft gray page.
- Header row has business name on the left, INVOICE / #NNNNN / date on the right with a black underline.
- Items table has bold uppercase headers, monospaced UPC column, right-aligned price columns.
- TOTAL row right-aligned with bold large amount.
- Footer line centered with light separator.

- [ ] **Step 3: Manual verification (print preview)**

In the same browser tab, press `Cmd+P` (or `Ctrl+P`). Browser print preview opens.

Expected:
- Paper size: US Letter.
- Invoice fills the page within the 0.5in margins, no gray background, no box-shadow border.
- No admin sidebar/topbar in the preview.
- Items spread across one page for a typical 5–10 item order.

Cancel the print dialog (do not actually print).

- [ ] **Step 4: Commit**

```bash
git add app/admin/orders/\[id\]/invoice/invoice.css
git commit -m "feat: invoice screen and print styles"
```

---

## Task 6: Wire `?print=1` and `?download=1` triggers

**Files:**
- Modify: `app/admin/orders/[id]/invoice/page.tsx`

- [ ] **Step 1: Add the search-param side-effect**

In `app/admin/orders/[id]/invoice/page.tsx`, update the imports at the top:
```tsx
"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { BUSINESS_NAME, INVOICE_FOOTER } from "@/lib/invoice-config";
import "./invoice.css";
```

Inside the `InvoicePage` component, after the existing `useEffect` that fetches the order, add a second `useEffect`:

```tsx
const searchParams = useSearchParams();

useEffect(() => {
  if (!order) return;

  const wantPrint = searchParams.get("print") === "1";
  const wantDownload = searchParams.get("download") === "1";

  if (wantPrint) {
    // Slight delay so the browser has painted the invoice before the dialog opens
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }

  if (wantDownload) {
    const root = document.getElementById("invoice-root");
    if (!root) return;
    let cancelled = false;
    (async () => {
      try {
        // html2pdf.js v0.10 has no shipped types; default export is a chainable factory.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const html2pdf = (await import("html2pdf.js")).default as any;
        if (cancelled) return;
        await html2pdf()
          .from(root)
          .set({
            filename: `invoice-${order.id}.pdf`,
            jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
            html2canvas: { scale: 2, useCORS: true },
            margin: 0.5,
          })
          .save();
      } catch {
        alert(
          "PDF generation failed. Use the Print button and choose 'Save as PDF' from the print dialog."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }
}, [order, searchParams]);
```

- [ ] **Step 2: Manual verification — print trigger**

In the dev server, visit `http://localhost:3000/admin/orders/<id>/invoice?print=1`.

Expected: page loads, invoice renders, browser print dialog opens automatically after ~300ms. Cancel the dialog.

- [ ] **Step 3: Manual verification — download trigger**

Visit `http://localhost:3000/admin/orders/<id>/invoice?download=1`.

Expected: page loads, invoice renders, after a moment a PDF file named `invoice-<id>.pdf` is offered for download. Open it and confirm the contents match the on-screen invoice.

If PDF generation fails, the alert with fallback instructions should appear; the tab should stay open.

- [ ] **Step 4: Manual verification — plain visit still works**

Visit `http://localhost:3000/admin/orders/<id>/invoice` (no query param).

Expected: invoice renders. No print dialog, no download. (Confirms the side-effect only runs when triggered.)

- [ ] **Step 5: Commit**

```bash
git add app/admin/orders/\[id\]/invoice/page.tsx
git commit -m "feat: invoice route handles ?print=1 and ?download=1"
```

---

## Task 7: Add Print and Download buttons to admin orders page

**Files:**
- Modify: `app/admin/orders/page.tsx`

- [ ] **Step 1: Add icon imports**

At the top of `app/admin/orders/page.tsx`, add `Printer` and `Download` to the lucide-react imports. The file currently doesn't import any lucide icons (verify and add a new import line if needed):
```tsx
import { Printer, Download } from "lucide-react";
```

- [ ] **Step 2: Add the action row to each expanded order panel**

In `app/admin/orders/page.tsx`, find the expanded panel block (currently the section beginning with `{isExpanded && (`). Inside that block, immediately after the opening `<div className="border-t border-[var(--candy-border)] p-4">` (around line 115), add the action row as the first child:

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

(`e.stopPropagation()` prevents the buttons from accidentally collapsing the expanded panel via the parent's click handler — even though they live inside the expanded body div, defensive in case the panel uses bubbling.)

- [ ] **Step 3: Manual verification**

Visit `/admin/orders`. Expand an order. Confirm:
- A row with "Print" and "Download PDF" buttons appears at the top of the expanded section.
- Clicking Print opens a new tab to the invoice route with the print dialog.
- Clicking Download PDF opens a new tab and triggers a PDF download.
- Clicking either button does NOT collapse the expanded panel in the original tab.
- The buttons render and look correct on mobile (the expanded panel is below the order row).

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "feat: add Print and Download PDF buttons to admin orders"
```

---

## Task 8: Add sort dropdown to admin products page

**Files:**
- Modify: `app/admin/products/page.tsx`

- [ ] **Step 1: Add sort state**

In `app/admin/products/page.tsx`, locate the existing state declarations (around lines 18-21). After `const [search, setSearch] = useState("");`, add:

```tsx
const [sortBy, setSortBy] = useState<"name" | "upc" | "category">("name");
```

- [ ] **Step 2: Replace the filtered derivation with filtered + sorted**

Locate the existing `filtered` derivation (currently lines 106-110):
```tsx
const filtered = products.filter(
  (p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.upc.includes(search)
);
```

Replace with:
```tsx
const filtered = products.filter(
  (p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.upc.includes(search)
);

const filteredSorted = [...filtered].sort((a, b) => {
  if (sortBy === "upc") return a.upc.localeCompare(b.upc);
  if (sortBy === "category") return a.category.localeCompare(b.category);
  return a.name.localeCompare(b.name);
});
```

- [ ] **Step 3: Rename consumers of `filtered` to `filteredSorted`**

In `app/admin/products/page.tsx`, find every JSX consumer of `filtered` (currently in the desktop table body — `{filtered.map(...)}` and `{filtered.length === 0 && ...}`, and in the mobile cards section — `{filtered.map(...)}` and `{filtered.length === 0 && ...}`). Replace each occurrence inside JSX with `filteredSorted`.

There should be 4 replacements in total (2 in desktop block, 2 in mobile block). Leave the `filtered` declaration itself in place — it's still the input to the sort.

- [ ] **Step 4: Wrap the search input and add the sort `<select>`**

Locate the existing search input (currently lines 150-155):
```tsx
<input
  placeholder="Search products..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="mb-4 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full max-w-sm"
/>
```

Replace with:
```tsx
<div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
  <input
    placeholder="Search products..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full sm:max-w-sm"
  />
  <select
    value={sortBy}
    onChange={(e) => setSortBy(e.target.value as "name" | "upc" | "category")}
    className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full sm:w-auto"
  >
    <option value="name">Alphabetical (A–Z)</option>
    <option value="upc">UPC</option>
    <option value="category">Category</option>
  </select>
</div>
```

- [ ] **Step 5: Manual verification**

Visit `/admin/products`. Confirm:
- Search and sort dropdown appear side-by-side on desktop, stacked on mobile.
- Default sort is Alphabetical (A–Z).
- Switching to UPC reorders both the desktop table and mobile cards by UPC ascending.
- Switching to Category groups products by category alphabetically.
- Typing in search filters first, then the sort is applied to the filtered subset.
- Edit/Create still work (sort doesn't break form rendering).

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/admin/products/page.tsx
git commit -m "feat: add sort dropdown to admin products page"
```

---

## Task 9: End-to-end manual verification

**Files:** None — verification only.

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: build succeeds with no errors. Note the new `/admin/orders/[id]/invoice` route in the build output.

- [ ] **Step 2: End-to-end invoice walkthrough**

Run: `npm run dev`. Log into admin. Find an order with:
- Some optional contact fields populated, some null.
- A note (find or submit one).

Then:
- Click Print on that order → confirm new tab, invoice loads, print dialog opens, preview shows clean US Letter document. Cancel dialog.
- Click Download PDF on the same order → confirm PDF downloads, named `invoice-<id>.pdf`. Open the PDF; confirm it matches the screen invoice, all sections present.
- Open the invoice in a tab WITHOUT a query param — invoice renders for preview, no action triggered.

- [ ] **Step 3: End-to-end with empty optional fields**

Find or submit an order with only first/last name + items (no email, phone, store address, no note).

- Visit the invoice route. Confirm the customer block only shows the name (no extra empty lines), and the Notes section is entirely absent.

- [ ] **Step 4: End-to-end product sort**

Visit `/admin/products`. Try:
- Default (Alphabetical) — confirm A→Z.
- Switch to UPC — confirm products reorder by UPC ascending.
- Switch to Category — confirm products group by category alphabetically.
- Search "candy" + sort UPC — confirm filter + sort compose correctly.
- Toggle to mobile width (resize browser narrow) — confirm sort dropdown stacks under search input, both still work.

- [ ] **Step 5: Final lint pass**

Run: `npm run lint`
Expected: no errors, no warnings introduced by this change.

- [ ] **Step 6: No commit needed** — verification only.
