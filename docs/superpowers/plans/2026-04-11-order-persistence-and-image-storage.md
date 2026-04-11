# Order Persistence & Product Image Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save every checkout order to the database before sending the confirmation email, and let admins upload product images that are stored as binary rows in Neon and served via a public API route.

**Architecture:** Two independent work streams sharing one plan. Order persistence restructures `/api/send-order` so a DB insert runs inside its own try/catch ahead of the Resend call — DB failure returns 500, email failure is logged and swallowed. Image storage adds a `product_images` table (bytea + content type), rewrites the admin upload route to upsert into it, adds a public `GET /api/images/[productId]` route that streams bytes with cache headers, and refactors `ProductForm` to pick a file in local state and defer the upload to after the product row is created/updated.

**Tech Stack:** Next.js 16 (App Router, async params), TypeScript, Drizzle ORM + `@netlify/neon` (Postgres), React 19, Resend

**Project testing convention:** This repo has no automated test framework. Verification steps use `npm run lint`, `npm run build`, manual browser/curl checks, and Drizzle Studio. Matches the convention of the prior plan `2026-04-10-candy-and-more-full-build.md`.

**Design spec:** `docs/superpowers/specs/2026-04-11-order-persistence-and-image-storage-design.md`

---

## File Structure

```
app/
├── api/
│   ├── send-order/
│   │   └── route.ts                  (MODIFY — Task 1: DB insert before email, split try/catch)
│   ├── admin/
│   │   └── upload/
│   │       └── route.ts              (REWRITE — Task 4: upsert into product_images, bump photoUrl)
│   └── images/
│       └── [productId]/
│           └── route.ts              (CREATE — Task 3: public GET, streams bytes with cache headers)
lib/
└── db/
    └── schema.ts                     (MODIFY — Task 2: bytea customType + productImagesTable)
components/
└── custom/
    ├── product-form.tsx              (MODIFY — Task 5: local file state, deferred upload on submit)
    └── image-uploader.tsx            (DELETE — Task 5: no longer used)
```

**Migration:** one-time `npm run db:push` in Task 2. Additive schema change, no data migration.

---

## Task 1: Persist orders in the send-order API route

**Files:**
- Modify: `app/api/send-order/route.ts`

The current handler sends an email via Resend but never persists the order. Restructure so the DB insert runs first inside its own try/catch (fail → 500), and the email send is wrapped in a second try/catch that only logs failures (fail → log + 200).

- [ ] **Step 1: Read the current handler to confirm starting state**

Run: `cat app/api/send-order/route.ts`

Expected: single outer try/catch, validation, `resend.emails.send`, no DB import.

- [ ] **Step 2: Replace the handler with the two-try/catch version**

Overwrite `app/api/send-order/route.ts` with:

```ts
// app/api/send-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { OrderPayload } from "@/lib/types";
import { buildOrderConfirmationHtml } from "@/lib/email-template";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  let body: OrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.customerFirstName || !body.customerLastName || !body.customerEmail) {
    return NextResponse.json(
      { error: "Missing required customer information" },
      { status: 400 }
    );
  }

  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // 1. Persist order — critical path. Failure returns 500.
  try {
    const db = getDb();
    await db.insert(ordersTable).values({
      customerFirstName: body.customerFirstName,
      customerLastName: body.customerLastName,
      customerEmail: body.customerEmail,
      note: body.note || null,
      items: JSON.stringify(body.items),
      totalPrice: body.totalPrice.toString(),
      submittedAt: new Date(body.submittedAt),
    });
  } catch (err) {
    console.error("[send-order] DB insert failed:", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  }

  // 2. Send confirmation email — nice-to-have. Failure is logged, not returned.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = buildOrderConfirmationHtml(body);
    const { error } = await resend.emails.send({
      from: "Candy & More <orders@candyandmoredistrocorp.com>",
      to: body.customerEmail,
      subject: `Order Confirmation — Candy & More`,
      html,
    });
    if (error) {
      console.error("[send-order] Resend returned error:", error);
    }
  } catch (err) {
    console.error("[send-order] Resend threw:", err);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify lint and typecheck pass**

Run: `npm run lint`

Expected: no errors in `app/api/send-order/route.ts`. If there's a warning about the unused `saved` variable or similar, remove it — the code above already avoids that.

- [ ] **Step 4: Manual verification — happy path**

Start the dev server: `netlify dev` (or `npm run dev` if `netlify dev` is not set up; the former is preferred so `@netlify/neon` auto-configures).

Then in the browser:
1. Visit `http://localhost:8888` (or the port printed by `netlify dev`).
2. Add a product to the cart.
3. Go to `/cart`, fill in first name, last name, email, optional note.
4. Click Submit Order.
5. Expect the green "Order Submitted!" screen.
6. Log in at `/admin/login`, go to `/admin/orders`.
7. Expect to see the order you just submitted with correct items, total, and note.

- [ ] **Step 5: Manual verification — email failure is swallowed**

Temporarily break the Resend key to confirm email failures don't fail the request:
1. In `.env.local`, set `RESEND_API_KEY=sk_invalid_placeholder`.
2. Restart `netlify dev`.
3. Submit another checkout in the browser.
4. Expect the green "Order Submitted!" screen (success).
5. Check the terminal running the dev server — expect to see `[send-order] Resend returned error:` or `[send-order] Resend threw:` logged.
6. Refresh `/admin/orders` — expect the new order to be visible.
7. Restore `RESEND_API_KEY` to its real value in `.env.local` and restart `netlify dev`.

- [ ] **Step 6: Commit**

```bash
git add app/api/send-order/route.ts
git commit -m "feat: persist orders to DB before sending confirmation email

DB insert runs first inside its own try/catch — failure returns 500 so
the user can retry. Email send is wrapped in a separate try/catch that
only logs failures so a Resend outage never loses a saved order."
```

---

## Task 2: Add product_images table to schema + push migration

**Files:**
- Modify: `lib/db/schema.ts`

Add a `bytea` custom type helper and a new `productImagesTable` keyed by `productId` with `onDelete: "cascade"` referencing `productsTable.id`. Then push the schema to Neon.

- [ ] **Step 1: Read the current schema to confirm starting state**

Run: `cat lib/db/schema.ts`

Expected: imports from `drizzle-orm/pg-core`, `productsTable`, `ordersTable`. No `customType` import, no `productImagesTable`.

- [ ] **Step 2: Overwrite lib/db/schema.ts with the new schema**

```ts
import {
  pgTable,
  text,
  numeric,
  timestamp,
  serial,
  customType,
} from "drizzle-orm/pg-core";

// Postgres bytea — Drizzle's neon-http driver has no first-class bytea helper,
// so we declare one via customType. Inputs are Buffers, reads return Buffers.
const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  upc: text("upc").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  photoUrl: text("photo_url").notNull().default("MISSING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerFirstName: text("customer_first_name").notNull(),
  customerLastName: text("customer_last_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  note: text("note"),
  items: text("items").notNull(), // JSON stringified array
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  submittedAt: timestamp("submitted_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productImagesTable = pgTable("product_images", {
  productId: text("product_id")
    .primaryKey()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

- [ ] **Step 3: Verify lint and typecheck pass**

Run: `npm run lint`

Expected: no errors in `lib/db/schema.ts`.

- [ ] **Step 4: Push the schema to Neon**

Run: `npm run db:push`

Expected output: Drizzle Kit prompts to apply the change, then reports the `product_images` table was created. If Drizzle asks how to interpret the new table (e.g., "create new table"), select "create".

- [ ] **Step 5: Manual verification — table exists in Neon**

Run: `npm run db:studio`

Expected: Drizzle Studio opens in the browser, `product_images` table is listed with columns `product_id`, `data`, `content_type`, `updated_at`. Close studio when done.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: add product_images table with bytea column

Stores admin-uploaded product images as binary rows keyed by product_id
with cascade delete. Uses Drizzle customType to declare the Postgres
bytea column, since neon-http has no first-class helper."
```

---

## Task 3: Create public image serving route

**Files:**
- Create: `app/api/images/[productId]/route.ts`

A public, unauthenticated `GET` that reads one row from `product_images` by `productId` and streams the bytes back with the stored content type and cache headers. Next.js 16 requires async `params`.

- [ ] **Step 1: Create the route file**

Create `app/api/images/[productId]/route.ts`:

```ts
// app/api/images/[productId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { productImagesTable } from "@/lib/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;

  const db = getDb();
  const [row] = await db
    .select()
    .from(productImagesTable)
    .where(eq(productImagesTable.productId, productId))
    .limit(1);

  if (!row) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(row.data, {
    status: 200,
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`

Expected: no errors. If lint complains about `_request` being unused, that's intentional — the leading underscore conventionally marks an intentionally-unused parameter; the Next.js handler signature requires it.

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`

Expected: build succeeds. Look for `app/api/images/[productId]/route` in the route listing.

- [ ] **Step 4: Manual verification — 404 for missing image**

Start `netlify dev` if not already running. Then in a terminal:

Run: `curl -i http://localhost:8888/api/images/upc_nonexistent`

Expected: `HTTP/1.1 404 Not Found` with body `Not Found`. (Port may differ — use whatever `netlify dev` printed.)

- [ ] **Step 5: Commit**

```bash
git add app/api/images/[productId]/route.ts
git commit -m "feat: add public image serving route

New GET /api/images/[productId] reads the bytea row for a product and
streams it back with the stored content type. One-hour browser cache
with a day-long stale-while-revalidate window."
```

---

## Task 4: Rewrite admin upload API to persist into product_images

**Files:**
- Modify: `app/api/admin/upload/route.ts`

Replace the filesystem `writeFile`/`mkdir` logic with an upsert into `product_images` and a second update that bumps `productsTable.photoUrl` to `/api/images/<productId>` so the catalog can resolve the new image through the serving route from Task 3.

- [ ] **Step 1: Read the current upload route to confirm starting state**

Run: `cat app/api/admin/upload/route.ts`

Expected: imports `writeFile`, `mkdir`, writes to `public/images/<id>.<ext>`.

- [ ] **Step 2: Replace the route with the DB-upsert version**

Overwrite `app/api/admin/upload/route.ts` with:

```ts
// app/api/admin/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productImagesTable, productsTable } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;

  if (!file || !productId) {
    return NextResponse.json(
      { error: "Missing file or productId" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";
  const now = new Date();

  const db = getDb();

  await db
    .insert(productImagesTable)
    .values({
      productId,
      data: buffer,
      contentType,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: productImagesTable.productId,
      set: {
        data: buffer,
        contentType,
        updatedAt: now,
      },
    });

  // Point the catalog at the serving route so public pages render the new image.
  const url = `/api/images/${productId}`;
  await db
    .update(productsTable)
    .set({ photoUrl: url, updatedAt: now })
    .where(eq(productsTable.id, productId));

  return NextResponse.json({ ok: true, url });
}
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`

Expected: no errors. The `fs/promises` and `path` imports from the old code are gone.

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 5: Manual verification — upload + serve round trip**

With `netlify dev` running:

1. Log in at `http://localhost:8888/admin/login`.
2. Go to `/admin/products`.
3. Pick any existing product (e.g., the first one) and note its id from Drizzle Studio if needed, or inspect via browser devtools on the product row.
4. Use `curl` to upload a test image to the API as that product — grab the `nf_token` from your browser's sessionStorage first:

   In browser devtools console (while logged in):
   ```
   console.log(sessionStorage.getItem("nf_token"))
   ```

   Then in terminal (replace `<TOKEN>` and `<PRODUCT_ID>`):
   ```
   curl -i -X POST http://localhost:8888/api/admin/upload \
     -H "Authorization: Bearer <TOKEN>" \
     -F "file=@/path/to/any-small.jpg" \
     -F "productId=<PRODUCT_ID>"
   ```

5. Expected response: `HTTP/1.1 200 OK` with body `{"ok":true,"url":"/api/images/<PRODUCT_ID>"}`.

6. In the browser, hit `http://localhost:8888/api/images/<PRODUCT_ID>` directly — expected: the image renders.

7. In Drizzle Studio (`npm run db:studio`), check the `products` row for `<PRODUCT_ID>` — expected: `photo_url` column now reads `/api/images/<PRODUCT_ID>`.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/upload/route.ts
git commit -m "feat: persist uploaded product images to Neon via bytea upsert

Replaces the filesystem writeFile approach (which does not work on
Netlify's read-only FS) with an upsert into product_images. Also
bumps products.photo_url to /api/images/<id> so the catalog resolves
the stored image through the public serving route."
```

---

## Task 5: Update ProductForm for deferred upload + delete ImageUploader

**Files:**
- Modify: `components/custom/product-form.tsx`
- Delete: `components/custom/image-uploader.tsx`

Right now `ProductForm` only renders `ImageUploader` if the product already exists (`form.id`), so new products can never get an image. Replace that with an inline file picker whose selected file is held in local state and uploaded **after** `onSave` returns, using the deterministic id generated by the admin products POST route (`upc_<upc>` for new, existing `form.id` for edits).

- [ ] **Step 1: Read the current ProductForm to confirm starting state**

Run: `cat components/custom/product-form.tsx`

Expected: imports `ImageUploader`, renders it conditionally on `form.id`, state is `form` + `saving`.

- [ ] **Step 2: Overwrite components/custom/product-form.tsx with the deferred-upload version**

```tsx
"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

interface ProductFormData {
  id?: string;
  upc: string;
  name: string;
  description: string;
  price: string;
  category: string;
  photoUrl: string;
}

interface ProductFormProps {
  initial?: ProductFormData;
  onSave: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES = [
  "Gummies & Chewy Candy",
  "Cookies & Wafers",
  "Chips & Snacks",
  "Chocolate Bars",
  "Gum & Mints",
  "Protein & Energy Bars",
  "Noodles & Soups",
  "Rolling Papers",
  "Fragrances & Candles",
];

export default function ProductForm({ initial, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormData>(
    initial || {
      upc: "",
      name: "",
      description: "",
      price: "",
      category: CATEGORIES[0],
      photoUrl: "MISSING",
    }
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    initial?.photoUrl && initial.photoUrl !== "MISSING" ? initial.photoUrl : null
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // 1. Create or update the product row first.
    await onSave(form);

    // 2. If the user picked a file, upload it using the known id.
    //    For new products the admin POST handler generates id = `upc_${upc}`.
    if (file) {
      const productId = form.id || `upc_${form.upc}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      const token = sessionStorage.getItem("nf_token");
      await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    }

    setSaving(false);
  }

  const inputClass =
    "border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          placeholder="UPC"
          value={form.upc}
          onChange={(e) => setForm({ ...form, upc: e.target.value })}
          className={inputClass}
        />
        <input
          required
          placeholder="Product name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputClass}
        />
      </div>
      <input
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className={inputClass}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          type="number"
          step="0.01"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className={inputClass}
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={inputClass}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Image picker — always visible, image is optional */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[var(--candy-border)] rounded-xl p-4 text-center cursor-pointer hover:border-[var(--candy-accent)] transition-colors"
      >
        {preview ? (
          <img
            src={preview}
            alt="Product preview"
            className="max-h-[120px] mx-auto mb-2 object-contain"
          />
        ) : (
          <Upload className="size-8 mx-auto mb-2 text-[var(--candy-muted)]" />
        )}
        <p className="text-xs text-[var(--candy-muted)]">
          {file ? file.name : "Click to upload image (optional)"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }
          }}
        />
      </div>

      <div className="flex gap-2.5 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl py-2.5 px-4 border border-[var(--candy-border)] bg-white text-sm font-bold text-[var(--candy-muted)] hover:bg-[#F1F5F9] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl py-2.5 px-6 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black text-sm transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
        >
          {saving ? "Saving..." : initial?.id ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Delete the now-unused ImageUploader**

Run: `rm components/custom/image-uploader.tsx`

Expected: file is gone. Nothing else in the codebase imports it (`ProductForm` was the only consumer, and the new version has no such import).

- [ ] **Step 4: Verify lint and build pass**

Run: `npm run lint && npm run build`

Expected: both succeed. The existing codebase already uses raw `<img>` tags in `product-card.tsx` and the old `image-uploader.tsx`, so `@next/next/no-img-element` is effectively off for this project — no disable comment needed. If another consumer of `ImageUploader` surfaces (it shouldn't), search the codebase: `grep -r "image-uploader" .` — expect zero source-file matches (docs don't count).

- [ ] **Step 5: Manual verification — new product with image**

With `netlify dev` running:

1. Log in at `/admin/login`.
2. Go to `/admin/products` and click "New Product".
3. Fill in UPC (e.g., `999001`), Name, Price, pick a category.
4. Click the dashed image box, pick a small test image. Expect the thumbnail to appear.
5. Click "Create".
6. Expect the form to close and the new product to appear in the product list.
7. Visit the public catalog (`/` in another tab) and find the new product. Expect its image to render.

- [ ] **Step 6: Manual verification — new product without image**

1. Click "New Product" again.
2. Fill in UPC (e.g., `999002`), Name, Price. **Do not** pick an image.
3. Click "Create".
4. Expect the form to close and the product to appear with a placeholder image on the public catalog.

- [ ] **Step 7: Manual verification — edit existing product, replace image**

1. Click the pencil icon on any existing product.
2. Expect its current image (or the Upload icon if none) in the picker.
3. Pick a different test image. Expect the thumbnail to update.
4. Click "Update".
5. On the public catalog, hard-reload the product card (Cmd+Shift+R / Ctrl+Shift+F5 to bypass the 1-hour cache header). Expect the new image.

- [ ] **Step 8: Manual verification — cascade delete**

1. Open Drizzle Studio: `npm run db:studio`.
2. Find the row for the product you uploaded an image to in Task 4 (or one you just created in Step 5).
3. Back in the admin UI, click the red trash icon for that product. Confirm.
4. Refresh Drizzle Studio. Expected: the row is gone from `products` AND from `product_images` (cascade).

- [ ] **Step 9: Commit**

```bash
git add components/custom/product-form.tsx
git rm components/custom/image-uploader.tsx
git commit -m "feat: deferred image upload in ProductForm, delete ImageUploader

File picker is now always visible (create and edit mode). Selected
file is held in local state and uploaded after onSave returns, using
the deterministic id (upc_<upc>) the admin products POST handler
generates for new products. ImageUploader is no longer used."
```

---

## Wrap-up

After all five tasks:

- [ ] **Final step: Full end-to-end smoke test**

With `netlify dev` running:

1. Public checkout → order appears in `/admin/orders`.
2. Create a product with an image → product and image both visible on the public catalog.
3. Create a product without an image → placeholder visible.
4. Edit a product and replace its image → new image visible after hard reload.
5. Delete that product → product gone from catalog, `product_images` row gone in Drizzle Studio.

If any of these fail, debug on the relevant task — do NOT patch symptoms in a new commit. The plan's task boundaries are where fixes belong.

- [ ] **Final commit (if any touch-up fixes were needed):**

```bash
git status
# If clean, nothing to do. Otherwise commit any touch-ups with a focused message.
```

Done.
