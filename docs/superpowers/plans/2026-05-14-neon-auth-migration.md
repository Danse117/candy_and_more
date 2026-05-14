# Neon Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Netlify Identity with Neon Auth (Better Auth) as the admin authentication layer. Auth becomes cookie-based and server-rendered.

**Architecture:** Server-side session check via `auth.getSession()` in a Server Component admin layout and a Next.js 16 `proxy.ts`. API routes use a `requireAdminSession()` guard. Sign-in is a server action; admin accounts are created in the Neon dashboard (no in-app signup). All client-side token storage and the Netlify Identity widget are removed.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, `@neondatabase/auth` (Better Auth wrapper), Drizzle ORM, Neon Postgres, TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-14-neon-auth-migration-design.md`

**Project testing convention:** Manual verification only. No unit/integration test infrastructure exists in this repo, so each task ends with a manual smoke test rather than a TDD red/green cycle.

---

## Task 1: Pre-implementation cleanup

Revert the uncommitted option-2 changes so the migration diff is clean. The spec documents that these files were touched by an abandoned attempt; we want them back to `main` before starting.

**Files:**
- Restore from HEAD: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/products/page.tsx`, `app/admin/orders/page.tsx`, `app/admin/orders/[id]/invoice/page.tsx`, `app/admin/recover/page.tsx`, `components/custom/netlify-identity-init.tsx`, `deno.lock`
- Delete: `lib/admin-auth.ts` (added during option-2 attempt; not on `main`)

- [ ] **Step 1: Confirm dirty files match the abandoned attempt**

```bash
git status --short
```

Expected output (exactly these eight modifications plus `lib/admin-auth.ts` as untracked):
```
 M app/admin/layout.tsx
 M app/admin/orders/[id]/invoice/page.tsx
 M app/admin/orders/page.tsx
 M app/admin/page.tsx
 M app/admin/products/page.tsx
 M app/admin/recover/page.tsx
 M components/custom/netlify-identity-init.tsx
 M deno.lock
?? lib/admin-auth.ts
```

If extra files appear, stop and ask before proceeding.

- [ ] **Step 2: Restore tracked files**

```bash
git restore app/admin/layout.tsx app/admin/page.tsx app/admin/products/page.tsx \
  app/admin/orders/page.tsx app/admin/orders/[id]/invoice/page.tsx \
  app/admin/recover/page.tsx components/custom/netlify-identity-init.tsx \
  deno.lock
```

- [ ] **Step 3: Delete untracked option-2 helper**

```bash
rm lib/admin-auth.ts
```

- [ ] **Step 4: Verify working tree is clean**

```bash
git status --short
```

Expected: empty output.

- [ ] **Step 5: No commit required for this task** — nothing changed in the index. Move on.

---

## Task 2: Install `@neondatabase/auth` and set up env vars

**Files:**
- Modify: `package.json` (via npm)
- Modify: `.env.local`

- [ ] **Step 1: Install the Neon Auth SDK**

```bash
npm install @neondatabase/auth@latest
```

Expected: a new entry under `dependencies` in `package.json`.

- [ ] **Step 2: Generate a cookie secret**

```bash
openssl rand -base64 32
```

Copy the output. It must be at least 32 characters; openssl returns 44 chars for 32 bytes base64. Do NOT reuse this secret for prod (Task 14 generates a separate one).

- [ ] **Step 3: Add env vars to `.env.local`**

Append these lines to `/Users/musashi/Desktop/candy_and_more/.env.local`:

```
NEON_AUTH_BASE_URL=https://ep-snowy-mud-am5fw9md.neonauth.c-5.us-east-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=<paste the openssl output from Step 2>
```

Resulting `.env.local` should contain exactly three keys: `RESEND_API_KEY`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`.

- [ ] **Step 4: Verify the SDK is installed**

```bash
node -e "console.log(require.resolve('@neondatabase/auth'))"
```

Expected: prints a path under `node_modules/@neondatabase/auth/...`. If MODULE_NOT_FOUND, repeat Step 1.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: install @neondatabase/auth SDK

Adds the dependency for the Neon Auth migration. Env vars are local-only
(in .gitignored .env.local) and will be set in Netlify env separately.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create the server auth instance and route handler

**Files:**
- Create: `lib/auth/server.ts`
- Create: `app/api/auth/[...path]/route.ts`

- [ ] **Step 1: Create the auth instance module**

Create `/Users/musashi/Desktop/candy_and_more/lib/auth/server.ts`:

```ts
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
```

- [ ] **Step 2: Create the auth API route handler**

Create `/Users/musashi/Desktop/candy_and_more/app/api/auth/[...path]/route.ts`:

```ts
import { auth } from "@/lib/auth/server";

export const { GET, POST } = auth.handler();
```

- [ ] **Step 3: Verify the import path resolves**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean (no errors). If `@neondatabase/auth/next/server` is the wrong subpath, the error will name the actual exported path — adjust the import in `lib/auth/server.ts` and re-check.

- [ ] **Step 4: Verify the handler endpoint is reachable**

Start dev server (if not already running):
```bash
npm run dev
```

In another terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/session
```

Expected: `200` or `401` (either is fine — both prove the route handler is wired up). A 404 means the file path is wrong.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/server.ts app/api/auth/
git commit -m "$(cat <<'EOF'
feat(auth): add Neon Auth server instance and route handler

createNeonAuth wired to /api/auth/[...path] to service sign-in, sign-out,
and session requests. Reads NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET
from process.env.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create the Next.js 16 proxy (middleware)

**Files:**
- Create: `proxy.ts` (at repo root, NOT inside `app/` or `src/`)

- [ ] **Step 1: Confirm this Next version uses `proxy.ts`**

```bash
ls /Users/musashi/Desktop/candy_and_more/node_modules/next/dist/docs/upgrading 2>/dev/null
```

If a doc exists mentioning `middleware.ts` → `proxy.ts`, this confirms Next 16's rename. (Per AGENTS.md, this is one of the breaking changes.)

If the docs aren't there, fall back to creating `middleware.ts` and the Next dev server will tell you in its startup log if the name is wrong.

- [ ] **Step 2: Create the proxy file**

Create `/Users/musashi/Desktop/candy_and_more/proxy.ts`:

```ts
import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/admin/login" });

export const config = {
  matcher: [
    "/admin",
    "/admin/((?!login).*)",
    "/api/admin/:path*",
  ],
};
```

The matcher excludes `/admin/login` via negative lookahead — without this exclusion, the proxy would redirect the login page to itself in a loop.

- [ ] **Step 3: Restart dev server to pick up proxy**

Proxies/middleware are loaded at server boot, not via HMR. Stop and restart:

```bash
# Stop the running dev server (Ctrl+C in its terminal), then:
npm run dev
```

Check the startup log for messages like `Middleware compiled` or `Proxy compiled`. If you see an error about the matcher, the negative lookahead regex syntax may differ — Next 16 release notes have the exact form.

- [ ] **Step 4: Verify gated access**

```bash
curl -s -o /dev/null -w "products page: %{http_code}\n" http://localhost:3000/admin/products
curl -s -o /dev/null -w "login page:    %{http_code}\n" http://localhost:3000/admin/login
curl -s -o /dev/null -w "admin api:     %{http_code}\n" http://localhost:3000/api/admin/products
```

Expected:
- `products page: 307` or `302` (redirect to login — proxy is doing its job)
- `login page: 200` (excluded from matcher, no redirect)
- `admin api: 401` (proxy returns 401 for API; not a redirect since it's an API path)

If any of these are unexpected, the matcher or `auth.middleware()` behavior differs from the docs. Add `console.log` calls inside `proxy.ts` temporarily to see what's matching.

- [ ] **Step 5: Commit**

```bash
git add proxy.ts
git commit -m "$(cat <<'EOF'
feat(auth): add Next.js 16 proxy gating /admin and /api/admin

Unauthenticated requests to /admin/* (except /admin/login) redirect to
the login page. Unauthenticated /api/admin/* requests return 401.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create the admin guard helper for API routes

The proxy already returns 401 for unauthenticated `/api/admin/*` requests, but API route code still needs access to `session.user` for any per-user logic and as defense-in-depth in case the proxy is ever bypassed (e.g., direct invocation in tests).

**Files:**
- Create: `lib/auth/admin-guard.ts`

- [ ] **Step 1: Create the guard helper**

Create `/Users/musashi/Desktop/candy_and_more/lib/auth/admin-guard.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "./server";

export async function requireAdminSession() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return {
      session: null as null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}
```

Pattern intentionally returns a discriminated tuple rather than throwing. Each API route does:

```ts
const { session, response } = await requireAdminSession();
if (response) return response;
// session.user is now non-null
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/admin-guard.ts
git commit -m "$(cat <<'EOF'
feat(auth): add requireAdminSession guard for API routes

Wraps auth.getSession() and returns either { session, response: null }
on success or { session: null, response: 401 } when missing. API routes
use the early-return pattern instead of throw/catch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rewrite the login page as a server-action form

**Files:**
- Create: `app/admin/login/actions.ts`
- Replace: `app/admin/login/page.tsx`

- [ ] **Step 1: Create the server action**

Create `/Users/musashi/Desktop/candy_and_more/app/admin/login/actions.ts`:

```ts
"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function signInWithEmail(
  _prev: { error: string } | null,
  formData: FormData,
) {
  const email = (formData.get("email") as string) || "";
  const password = (formData.get("password") as string) || "";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    return { error: error.message || "Failed to sign in." };
  }

  redirect("/admin");
}
```

- [ ] **Step 2: Replace the login page**

Overwrite `/Users/musashi/Desktop/candy_and_more/app/admin/login/page.tsx` (current content uses the Netlify Identity widget — replace entirely):

```tsx
"use client";

import { useActionState } from "react";
import { signInWithEmail } from "./actions";

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, null);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        action={formAction}
        className="bg-white border border-[var(--candy-border)] rounded-[20px] shadow-[var(--candy-shadow)] p-8 max-w-sm w-full"
      >
        <h1 className="text-2xl font-black mb-2 text-center">
          Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
        </h1>
        <p className="text-[var(--candy-muted)] text-sm mb-6 text-center">
          Admin Dashboard
        </p>

        {state?.error && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] text-sm">
            {state.error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

The styling mirrors the original Netlify Identity login card so visual continuity is preserved.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 4: Visual smoke test**

Open `http://localhost:3000/admin/login` in a browser. Expected:
- Centered card with the Candy & More heading
- Email and Password inputs
- Sign In button
- No JS console errors

Don't try to sign in yet — the admin layout still uses the old Netlify Identity flow and the dashboard route doesn't have a user yet (account creation is post-deploy). Form submission will round-trip but the page after redirect will be wrong until Task 7.

- [ ] **Step 5: Commit**

```bash
git add app/admin/login/
git commit -m "$(cat <<'EOF'
feat(auth): rewrite /admin/login as server-action form

Email + password form posts to a server action calling auth.signIn.email().
Replaces the Netlify Identity widget modal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Convert admin layout to a Server Component with AdminShell client wrapper

**Files:**
- Create: `components/custom/admin-shell.tsx`
- Create: `components/custom/admin-shell-actions.ts`
- Replace: `app/admin/layout.tsx`

- [ ] **Step 1: Create the sign-out server action**

Create `/Users/musashi/Desktop/candy_and_more/components/custom/admin-shell-actions.ts`:

```ts
"use server";

import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function signOutAction() {
  await auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 2: Create AdminShell client component**

Create `/Users/musashi/Desktop/candy_and_more/components/custom/admin-shell.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import AdminSidebar from "@/components/custom/admin-sidebar";
import { signOutAction } from "./admin-shell-actions";

const INVOICE_ROUTE = /^\/admin\/orders\/\d+\/invoice$/;

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (INVOICE_ROUTE.test(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar
        onLogout={() => signOutAction()}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-3 border-b border-[var(--candy-border)] bg-white md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-black">
            Candy <span className="text-[var(--candy-accent)]">&amp;</span> More
          </span>
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-[var(--candy-bg)]">
          {children}
        </main>
      </div>
    </div>
  );
}
```

Note: the previous layout returned `null` until `authenticated` was set. With the proxy redirecting unauthenticated requests upstream and the server-rendered layout doing the redirect, we no longer need any client-side `authenticated` state.

- [ ] **Step 3: Replace the admin layout**

Overwrite `/Users/musashi/Desktop/candy_and_more/app/admin/layout.tsx`:

```tsx
import { auth } from "@/lib/auth/server";
import AdminShell from "@/components/custom/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = await auth.getSession();

  // The proxy redirects ALL unauthenticated /admin/* requests to /admin/login
  // BEFORE this layout runs. So the only way to reach this code path without
  // a session is the login page itself. In that case, render children plain
  // (no sidebar/shell).
  if (!session?.user) {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
```

This avoids the redirect-loop problem entirely. `/admin/login` is excluded by the proxy matcher, so when this layout renders for the login page it has no session — and we just pass children through unchanged. For every other admin path, the proxy guarantees a session is present.

- [ ] **Step 4: Verify the login page renders without infinite redirect**

```bash
curl -s -o /dev/null -w "login: %{http_code}\n" http://localhost:3000/admin/login
```

Expected: `200` (no 307 redirect chain).

Then open `http://localhost:3000/admin/login` in a browser — the login card should render, not a blank page. If you see the AdminShell sidebar around the login form, the session check is misbehaving — likely `auth.getSession()` is throwing in the no-cookie case instead of returning `{ data: null }`. Wrap in try/catch and treat thrown errors as no-session.

- [ ] **Step 5: Typecheck and build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -10
```

Expected: clean compile and ✓ Compiled successfully.

- [ ] **Step 6: Commit**

```bash
git add app/admin/layout.tsx components/custom/admin-shell.tsx components/custom/admin-shell-actions.ts
git commit -m "$(cat <<'EOF'
feat(auth): convert admin layout to Server Component using Neon Auth

Layout calls auth.getSession() server-side. Sidebar interactivity moves
into a new AdminShell client component. Sign-out is a server action
that clears the cookie and redirects to /admin/login.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Switch API routes to `requireAdminSession`

There are seven admin API routes that currently call `validateAdminToken(request)`. Switch each one. The body of each route is otherwise unchanged.

**Files:**
- Modify: `app/api/admin/products/route.ts`
- Modify: `app/api/admin/products/[id]/route.ts`
- Modify: `app/api/admin/upload/route.ts`
- Modify: `app/api/admin/orders/route.ts`
- Modify: `app/api/admin/orders/[id]/route.ts`
- Modify: `app/api/admin/orders/[id]/fulfill/route.ts`

- [ ] **Step 1: Update products list/create route**

Edit `app/api/admin/products/route.ts`. Replace the import and the two auth checks:

Old:
```ts
import { validateAdminToken } from "@/lib/auth";
// ...
const user = await validateAdminToken(request);
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

New (in BOTH `GET` and `POST` handlers):
```ts
import { requireAdminSession } from "@/lib/auth/admin-guard";
// ...
const { response } = await requireAdminSession();
if (response) return response;
```

Both handlers (`GET`, `POST`) get the same two-line replacement. `request` is no longer needed for auth — it remains as the handler parameter for the body parsing in `POST`.

- [ ] **Step 2: Update products [id] route**

Same pattern in `app/api/admin/products/[id]/route.ts` for `PUT` and `DELETE` handlers.

- [ ] **Step 3: Update upload route**

Same pattern in `app/api/admin/upload/route.ts`.

- [ ] **Step 4: Update orders list route**

Same pattern in `app/api/admin/orders/route.ts` (`GET`).

- [ ] **Step 5: Update orders [id] route**

Same pattern in `app/api/admin/orders/[id]/route.ts` (`GET`).

- [ ] **Step 6: Update fulfill route**

Same pattern in `app/api/admin/orders/[id]/fulfill/route.ts` (`POST`).

- [ ] **Step 7: Verify no remaining `validateAdminToken` references**

```bash
grep -rn "validateAdminToken" /Users/musashi/Desktop/candy_and_more/app /Users/musashi/Desktop/candy_and_more/lib 2>/dev/null
```

Expected: empty output.

- [ ] **Step 8: Typecheck and build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add app/api/admin/
git commit -m "$(cat <<'EOF'
feat(auth): switch admin API routes to requireAdminSession

All seven /api/admin/* handlers now use the Neon Auth session guard
instead of validateAdminToken. The proxy is the primary defense; this
guard is in-route belt-and-suspenders.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Strip Bearer token headers from admin page fetches

Cookies are sent automatically on same-origin requests, so the `Authorization: Bearer ${token}` plumbing on every admin fetch becomes dead code. Remove it.

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/products/page.tsx`
- Modify: `app/admin/orders/page.tsx`
- Modify: `app/admin/orders/[id]/invoice/page.tsx`

- [ ] **Step 1: Update dashboard**

Edit `app/admin/page.tsx`. Replace the entire `useEffect` block (currently reads `sessionStorage.getItem("nf_token")`):

```tsx
useEffect(() => {
  Promise.all([
    fetch("/api/admin/products").then((r) => r.json()),
    fetch("/api/admin/orders").then((r) => r.json()),
  ]).then(([products, orders]) => {
    setStats({
      productCount: Array.isArray(products) ? products.length : 0,
      orderCount: Array.isArray(orders) ? orders.length : 0,
    });
  });
}, []);
```

- [ ] **Step 2: Update products page**

Edit `app/admin/products/page.tsx`. Remove the top-level `token` and `headers` consts. Replace each fetch call to drop `Authorization`:

`loadProducts`:
```tsx
async function loadProducts() {
  const res = await fetch("/api/admin/products");
  if (res.ok) setProducts(await res.json());
}
```

`handleCreate` (POST + image upload):
```tsx
const res = await fetch("/api/admin/products", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
// ...
const uploadRes = await fetch("/api/admin/upload", {
  method: "POST",
  body: fd,
});
```

`handleUpdate`: same pattern as create — drop `Authorization`, keep `Content-Type: application/json` for the JSON PUT.

`handleDelete`:
```tsx
await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
```

- [ ] **Step 3: Update orders page**

Edit `app/admin/orders/page.tsx`. Remove `sessionStorage.getItem("nf_token")` and the `headers` const from the initial `useEffect`:

```tsx
useEffect(() => {
  Promise.all([
    fetch("/api/admin/orders").then((r) => r.json()),
    fetch("/api/admin/products").then((r) => r.json()),
  ]).then(([ordersData, productsData]) => {
    if (Array.isArray(ordersData)) setOrders(ordersData);
    if (Array.isArray(productsData)) {
      const map: Record<string, string> = {};
      for (const p of productsData as ProductSummary[]) {
        map[p.id] = p.photoUrl;
      }
      setPhotoByProductId(map);
    }
  });
}, []);
```

And `toggleFulfilled` — drop `Authorization`:

```tsx
const res = await fetch(`/api/admin/orders/${order.id}/fulfill`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fulfilled: nextValue }),
});
```

- [ ] **Step 4: Update invoice page**

Edit `app/admin/orders/[id]/invoice/page.tsx`. Drop `sessionStorage.getItem` and `Authorization`:

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

- [ ] **Step 5: Verify no sessionStorage/nf_token in app code**

```bash
grep -rn "sessionStorage\|nf_token" /Users/musashi/Desktop/candy_and_more/app /Users/musashi/Desktop/candy_and_more/components /Users/musashi/Desktop/candy_and_more/lib 2>/dev/null | grep -v node_modules
```

Expected: empty.

- [ ] **Step 6: Build**

```bash
npm run build 2>&1 | tail -5
```

Expected: ✓ Compiled successfully.

- [ ] **Step 7: Commit**

```bash
git add app/admin/page.tsx app/admin/products/page.tsx app/admin/orders/page.tsx app/admin/orders/[id]/invoice/page.tsx
git commit -m "$(cat <<'EOF'
refactor(admin): drop Authorization headers from admin page fetches

Cookies are sent automatically on same-origin requests under Neon Auth,
so the Bearer-token plumbing on every admin fetch is dead. Removes the
sessionStorage reads and the manual header construction.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Remove Netlify Identity initializer and recovery from root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Strip the widget and the recovery-redirect script**

Edit `app/layout.tsx`. Remove:
- The `<Script id="nf-recovery-redirect" ...>` block (lines 33-42 in the current file)
- The `<NetlifyIdentityInit />` mount (line 43)
- The `import NetlifyIdentityInit from "@/components/custom/netlify-identity-init";` line at the top

If `Script` from `next/script` is no longer used elsewhere in this file, also remove that import.

Resulting body should be:

```tsx
<body className="min-h-full flex flex-col font-sans overflow-x-hidden">
  <CartProvider products={products}>{children}</CartProvider>
</body>
```

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -5
```

Expected: ✓ Compiled successfully.

- [ ] **Step 3: Visual smoke test on the catalog (non-admin) side**

Open `http://localhost:3000/` in a browser. Expected:
- Product catalog loads as before
- No JS console errors
- No request to `identity.netlify.com` (check Network tab)

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "$(cat <<'EOF'
chore(auth): remove Netlify Identity widget from root layout

Drops NetlifyIdentityInit and the recovery-redirect script. Auth is now
fully handled by Neon Auth cookies and server-side checks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Delete dead auth code and dependencies

**Files:**
- Delete: `components/custom/netlify-identity-init.tsx`
- Delete: `app/admin/recover/page.tsx`
- Delete: `lib/auth.ts`
- Modify: `package.json` (remove `netlify-identity-widget`, `@types/netlify-identity-widget`)

- [ ] **Step 1: Delete files**

```bash
rm components/custom/netlify-identity-init.tsx
rm app/admin/recover/page.tsx
rm lib/auth.ts
```

- [ ] **Step 2: Verify no remaining references**

```bash
grep -rn "netlify-identity-widget\|NetlifyIdentityInit\|validateAdminToken\|netlifyIdentity\|@/lib/auth\"" \
  /Users/musashi/Desktop/candy_and_more/app \
  /Users/musashi/Desktop/candy_and_more/components \
  /Users/musashi/Desktop/candy_and_more/lib 2>/dev/null
```

Expected: empty (no remaining usages). `@/lib/auth"` is quoted to avoid matching `@/lib/auth/server` or `@/lib/auth/admin-guard`.

- [ ] **Step 3: Remove npm dependencies**

```bash
npm uninstall netlify-identity-widget @types/netlify-identity-widget
```

- [ ] **Step 4: Build + lint to confirm nothing's left**

```bash
npm run build 2>&1 | tail -5 && npm run lint 2>&1 | tail -5
```

Expected: ✓ Compiled successfully and no NEW lint errors (the pre-existing `setSidebarOpen` lint warning in `AdminSidebar` is unchanged).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(auth): remove Netlify Identity widget and dead auth code

Deletes the widget component, the recovery page, the JWT validator, and
the npm dependencies. Neon Auth fully replaces all of this.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Local end-to-end smoke test

Before deploying, walk through the full auth flow locally.

- [ ] **Step 1: Create a test admin in the Neon dashboard**

Open the Neon Auth dashboard for this project (link is in your Neon console under the Auth tab) and create a user with a known email/password. Use a real-looking email — Better Auth may validate format.

- [ ] **Step 2: Restart dev server (clean state)**

```bash
# Stop any running dev server, then:
npm run dev
```

- [ ] **Step 3: Test the redirect**

In a fresh browser private window, visit `http://localhost:3000/admin/products`.
Expected: redirected to `http://localhost:3000/admin/login`.

- [ ] **Step 4: Test sign-in**

Enter the credentials from Step 1. Submit.
Expected: land on `/admin` (dashboard). Stats counts visible.

- [ ] **Step 5: Test product/order navigation**

Click "Products" in the sidebar. Expected: product list loads.
Click "Orders". Expected: orders list loads.

- [ ] **Step 6: Test new-tab persistence**

In the same private window, open a new tab via Cmd+T, type `localhost:3000/admin/products`, hit Enter.
Expected: products load immediately, no bounce to login. (Cookies are per-origin, not per-tab — this was the original bug.)

- [ ] **Step 7: Test sign-out**

Click "Sign Out" in the sidebar.
Expected: redirected to `/admin/login`. Visiting `/admin/products` now redirects to login.

- [ ] **Step 8: Test API guard with curl**

```bash
curl -s -o /dev/null -w "no cookie:  %{http_code}\n" http://localhost:3000/api/admin/products
```

Expected: `401` or `307` (redirect).

If any step fails, return to the relevant task. Don't proceed to prod until this passes end-to-end.

- [ ] **Step 9: No commit — this is verification only**

---

## Task 13: Set prod env vars and deploy

**Files:**
- Netlify project env (no file in repo)

- [ ] **Step 1: Generate a fresh cookie secret for prod**

```bash
openssl rand -base64 32
```

This MUST be different from the local secret. Copy the output.

- [ ] **Step 2: Set both Neon Auth env vars in Netlify**

```bash
netlify env:set NEON_AUTH_BASE_URL "https://ep-snowy-mud-am5fw9md.neonauth.c-5.us-east-1.aws.neon.tech/neondb/auth"
netlify env:set NEON_AUTH_COOKIE_SECRET "<paste the openssl output from Step 1>"
```

- [ ] **Step 3: Verify**

```bash
netlify env:list --plain | grep NEON_AUTH
```

Expected: two lines showing both keys.

- [ ] **Step 4: Push and deploy**

```bash
git push origin main
```

Watch the Netlify deploy in their dashboard until it goes from "building" → "published".

- [ ] **Step 5: Create the real admin account in the Neon dashboard**

Same as Task 12 Step 1 but with your real email/password. (You may have already done this — if so, skip.)

- [ ] **Step 6: Prod smoke test**

Visit `https://candyandmoredistrocorp.com/admin/products` in a fresh private browser window.

Run through the same checks as Task 12 (Steps 3–8) but against prod.

If sign-in fails, check Netlify function logs:
```bash
netlify logs:function | tail -50
```

Common issues:
- Cookie secret missing → "Cookie secret not configured"
- Base URL typo → "Failed to fetch session"

- [ ] **Step 7: No commit — deployment is the action**

---

## Task 14: Update CLAUDE.md / AGENTS.md

**Files:**
- Modify: `CLAUDE.md`

The project README / CLAUDE.md doesn't currently mention auth. Add a brief note so future work knows the auth model.

- [ ] **Step 1: Add an Auth section to CLAUDE.md**

Append under "## Architecture":

```markdown
### Auth

Admin pages and `/api/admin/*` routes are gated by Neon Auth (Better Auth).

- Server-side: `auth.getSession()` from `lib/auth/server.ts` reads the session
  from an httpOnly cookie set by Neon Auth.
- Proxy: `proxy.ts` at the repo root enforces the redirect to `/admin/login`
  on unauthenticated `/admin/*` requests and returns 401 on unauthenticated
  `/api/admin/*` requests.
- API routes: each calls `await requireAdminSession()` from
  `lib/auth/admin-guard.ts` for defense-in-depth.
- Admin accounts are created in the Neon Auth dashboard. There is no in-app
  signup or password-reset UI; reset is done via the Neon dashboard.
- Env vars: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (32+ chars,
  unique per environment).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document Neon Auth model in CLAUDE.md

Brief Auth section under Architecture so future work knows the gating
model, where the session check lives, and how to create admin accounts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Self-review notes (for the implementer)

- If Task 4 reveals `proxy.ts` is the wrong filename for this Next 16 version, fall back to `middleware.ts`. Either way, do not split logic across both.
- If Task 7 Step 4 hits the redirect-loop problem and the `headers()` approach doesn't work, the cleanest fallback is to move `/admin/login` *out* of the admin layout segment by colocating its own `layout.tsx` that just returns `<>{children}</>`. Do NOT skip the auth check unconditionally in the parent layout — that defeats the purpose.
- If `auth.signIn.email` or `auth.signOut` are not on the SDK surface in this version, check `node_modules/@neondatabase/auth/dist/*.d.ts` for the actual exported method names and adjust. The spec assumes the documented API; the SDK is new and may differ.
- The pre-existing lint warning on `AdminSidebar`'s `setSidebarOpen(false)` is NOT in scope for this plan. Leave it.
