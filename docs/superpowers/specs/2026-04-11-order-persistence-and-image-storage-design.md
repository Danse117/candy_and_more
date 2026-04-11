# Order Persistence & Product Image Storage — Design

**Date:** 2026-04-11
**Status:** Approved

## Goal

Two related gaps in the current admin/checkout flow:

1. **Orders are not persisted.** `/api/send-order` sends a confirmation email via Resend but never writes the order to the database, so the admin orders page shows nothing the admin actually submitted.
2. **Admin-created products cannot have images.** `ProductForm` only renders `ImageUploader` after a product exists, and the current upload route writes to `public/images/` — which does not work on Netlify's read-only filesystem.

The fix: save every submitted order to the DB inside `/api/send-order`, and store admin-uploaded product images as binary rows in Neon (same Postgres we already use). No new services, no Netlify Blobs.

Existing product images shipped with the repo (`public/images/*.jpg`) stay on disk and are served by Next as they are today. Only admin-uploaded images live in the DB.

## Non-Goals

- Image compression, resizing, or thumbnails.
- Multiple images per product. One canonical image per product, keyed by product id.
- Migrating the existing repo-shipped images into the DB.
- Client-side cart persistence, order editing, or order status tracking.

## Architecture Overview

Six focused changes:

1. Extend `POST /api/send-order` to insert the order into `orders` before sending email.
2. Add a `product_images` table (bytea + content type) keyed by `product_id`.
3. Rewrite `POST /api/admin/upload` to upsert a row into `product_images`.
4. Add a new public route `GET /api/images/[productId]` that streams the binary back with cache headers.
5. Update `ProductForm` to accept a file in local state and defer the upload until after the product row is created/updated.
6. Delete the now-unused immediate-upload `ImageUploader` component.

Each change has a single responsibility and touches one file (plus one deletion). Nothing in the catalog, cart, or public site changes.

## Section 1 — Order Persistence

**File:** `app/api/send-order/route.ts`

The existing handler has a single outer `try/catch` around everything. Restructure so the DB insert and the email send have distinct failure modes:

```ts
// (after validation, inside the existing try)
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

// DB write succeeded — from here on, email failures do not fail the request
try {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ ...existing args... });
  if (error) {
    console.error("[send-order] Resend returned error:", error);
  }
} catch (err) {
  console.error("[send-order] Resend threw:", err);
}

return NextResponse.json({ ok: true });
```

### Error handling decision

The DB write is the **critical path**. Email is a **nice-to-have notification**.

- **DB insert fails** → return `500` with `{ error: "Failed to save order" }`. User sees the checkout failure, cart stays intact, they can retry. No orphaned confirmation for a lost order.
- **DB insert succeeds, email send fails (return or throw)** → `console.error` the failure, return `200` with `{ ok: true }`. The order is saved; admin sees it; a missing confirmation email is acceptable. Rolling back the DB would leave the user in a worse state (failed checkout for a valid order).

Netlify captures `stderr` from Functions automatically, so `console.error` is sufficient — no external logging service needed.

No client-side changes. `cart-client.tsx` already POSTs the correct `OrderPayload` shape and reads `{ ok: true }` on success.

## Section 2 — Schema: `product_images` Table

**File:** `lib/db/schema.ts`

Drizzle has no first-class `bytea` helper for `neon-http`, so use `customType`:

```ts
import { customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; notNull: true; default: false }>({
  dataType() {
    return "bytea";
  },
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

**Why these choices:**

- `productId` as PK (not a surrogate id): one image per product, natural unique key, no risk of orphan rows after an update.
- `onDelete: "cascade"`: deleting a product automatically drops its image. No manual cleanup in the delete route.
- `contentType` stored alongside bytes so the serving route can set the correct `Content-Type` header without inferring from the URL.
- `updatedAt`: used by the serving route for weak cache validation / debugging.

**Migration:** one-time `npm run db:push`. Additive change, no data migration needed.

## Section 3 — Upload Route Rewrite

**File:** `app/api/admin/upload/route.ts`

Replace the `writeFile`/`mkdir` filesystem path with a DB upsert. Signature and auth stay identical.

```ts
const buffer = Buffer.from(await file.arrayBuffer());
const db = getDb();

await db.insert(productImagesTable)
  .values({
    productId,
    data: buffer,
    contentType: file.type || "image/jpeg",
    updatedAt: new Date(),
  })
  .onConflictDoUpdate({
    target: productImagesTable.productId,
    set: {
      data: buffer,
      contentType: file.type || "image/jpeg",
      updatedAt: new Date(),
    },
  });

// Also bump productsTable.photoUrl so the catalog can resolve the image
await db.update(productsTable)
  .set({ photoUrl: `/api/images/${productId}` })
  .where(eq(productsTable.id, productId));

return NextResponse.json({ ok: true, url: `/api/images/${productId}` });
```

**Upsert** rather than insert: editing a product and replacing its image should overwrite, not error out.

**`photoUrl` bump** keeps the rest of the catalog untouched — it already renders `<img src={product.photoUrl} />` against whatever string is in that column, so pointing it at `/api/images/<id>` means the public site "just works" without a special-case check.

## Section 4 — Public Image Serving Route

**File:** `app/api/images/[productId]/route.ts` (new)

Public, unauthenticated. The catalog is public, so images must be too.

```ts
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

**Cache strategy:**

- `max-age=3600` — browsers cache for an hour. Product images rarely change.
- `stale-while-revalidate=86400` — acceptable to serve stale for a day while re-fetching, keeps the catalog snappy.
- Images are content-keyed by `productId`, so a new upload at the same id is invalidated by the browser after an hour. Good enough for admin edits; if an admin needs an instant refresh they can hard-reload.

Next.js 16 async params pattern is required (`params: Promise<...>` + `await`).

## Section 5 — ProductForm Rewrite

**File:** `components/custom/product-form.tsx`

Replace "conditionally render ImageUploader after save" with "pick a file locally, upload on submit."

### State

```tsx
const [file, setFile] = useState<File | null>(null);
const [preview, setPreview] = useState<string | null>(
  initial?.photoUrl && initial.photoUrl !== "MISSING" ? initial.photoUrl : null
);
```

### UI

Always render a file picker (create mode and edit mode), with a thumbnail showing either the existing `photoUrl` or the local object URL preview of a newly-picked file:

```tsx
<div
  onClick={() => inputRef.current?.click()}
  className="border-2 border-dashed ..."
>
  {preview ? <img src={preview} ... /> : <Upload ... />}
  <p>{file ? file.name : "Click to upload image (optional)"}</p>
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
```

### Submit flow (the critical bit)

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSaving(true);

  // 1. Create or update the product row (id is known afterwards)
  await onSave(form);

  // 2. If user picked a file, upload it now using the known id
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
```

**Why it works:** the existing POST handler for new products generates `id = \`upc_${body.upc}\`` deterministically. The form already has `form.upc`, so the client can predict the id. For edits, `form.id` is already set.

Image is **optional** for both create and edit. Nothing breaks if the user skips the picker — `photoUrl` stays `"MISSING"` for new products and the catalog renders a placeholder as it does today.

## Section 6 — Cleanup

**Delete:** `components/custom/image-uploader.tsx`

No longer used. The deferred-upload flow lives inline in `ProductForm` now. Dead code would just confuse future readers.

## File Change Summary

| # | File | Action |
|---|------|--------|
| 1 | `lib/db/schema.ts` | Modify: add `productImagesTable` + `bytea` customType |
| 2 | `app/api/send-order/route.ts` | Modify: insert into `orders` before sending email |
| 3 | `app/api/admin/upload/route.ts` | Rewrite: upsert into `product_images`, bump `photoUrl` |
| 4 | `app/api/images/[productId]/route.ts` | Create: public GET handler streaming image bytes |
| 5 | `components/custom/product-form.tsx` | Modify: local file state, deferred upload on submit |
| 6 | `components/custom/image-uploader.tsx` | Delete |

**One-time migration:** `npm run db:push` after the schema change.

## Testing Notes

Manual verification steps for the implementation plan:

1. Check out on the public site → new row visible in `/admin/orders` with correct items/total/note.
2. Simulate email failure (bad Resend key) → order still saved, page still succeeds.
3. Create a new product with an image → image appears in catalog.
4. Create a new product without an image → product appears with placeholder.
5. Edit an existing product and replace its image → new image shown after cache expiry / hard reload.
6. Delete a product → confirm `product_images` row is gone (cascade).

## Open Questions

None. User approved the design.
