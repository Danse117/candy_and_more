# Neon Auth Migration — Design

**Date:** 2026-05-14
**Status:** Approved

## Goal

Replace Netlify Identity with Neon Auth (Better Auth) as the admin authentication layer. Auth becomes cookie-based and server-rendered: the admin layout calls `auth.getSession()` server-side and redirects to `/admin/login` if absent. No client-side token storage, no async "wait for widget" dance, no per-tab `sessionStorage` mismatch.

## Non-Goals

- Public user accounts. Admin-only; one owner.
- In-app signup UI. Admin users are created in the Neon dashboard.
- Password recovery flow. Reset is done via the Neon dashboard.
- Role-based access control. Any user with a valid Neon Auth session is treated as admin (the dashboard-managed allowlist *is* the access control).
- Migrating any existing Netlify Identity users — the user has confirmed there are none to preserve.

## Architecture Overview

Five focused changes:

1. **Add Neon Auth server SDK and config** — `lib/auth/server.ts` exports a `createNeonAuth()` instance. The `[...path]` handler at `/api/auth/[...path]/route.ts` services sign-in/out/session requests under the hood.
2. **Add Next.js 16 proxy** (`proxy.ts` at repo root) — gates `/admin/:path*` and `/api/admin/:path*`. Unauthenticated requests to admin pages redirect to `/admin/login`; unauthenticated requests to admin API routes return 401.
3. **Convert admin layout to a Server Component** — `app/admin/layout.tsx` calls `auth.getSession()` directly. Unauthenticated visits are redirected by the proxy before this even runs; the layout's only auth role is to pass the session to a small client wrapper that owns the sidebar + logout button.
4. **Rewrite `/admin/login`** — uses a server action `signInWithEmail()` that calls `auth.signIn.email()`. Email + password form only.
5. **Replace per-route JWT validation in API routes** with `await requireAdminSession()` from a new `lib/auth/admin-guard.ts`. The guard wraps `auth.getSession()` and short-circuits 401 if missing.

The Netlify Identity widget, its initializer component, its types package, the recovery page, and all `sessionStorage` token plumbing on the client are removed entirely.

## Environment

Add to `.env.local` (and Netlify project env for prod):

```
NEON_AUTH_BASE_URL=https://ep-snowy-mud-am5fw9md.neonauth.c-5.us-east-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=<32+ random bytes from `openssl rand -base64 32`>
```

The cookie secret must be different per environment — local and prod each get their own. Anyone with the secret can forge cookies.

## File-by-file

### Added

**`lib/auth/server.ts`**

```ts
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
```

**`app/api/auth/[...path]/route.ts`**

```ts
import { auth } from "@/lib/auth/server";
export const { GET, POST } = auth.handler();
```

**`proxy.ts`** (Next.js 16 renamed `middleware.ts` → `proxy.ts`)

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

The matcher explicitly excludes `/admin/login` via negative lookahead — `/admin/((?!login).*)` matches any path under `/admin/` *except* one starting with `login`. Without this exclusion the proxy would redirect the login page to itself and loop. The matcher also omits `/api/auth/*` entirely so Neon Auth's own request handler is reachable while logged out.

**Implementation note:** when wiring this up, verify the exact API surface of `@neondatabase/auth` — `auth.middleware()` may or may not auto-skip its own `loginUrl`. The explicit negative-lookahead matcher above is defense-in-depth; even if the SDK already skips its loginUrl, the matcher costs nothing.

**`lib/auth/admin-guard.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "./server";

export async function requireAdminSession() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}
```

Usage in each API route:

```ts
const { session, response } = await requireAdminSession();
if (response) return response;
// ...proceed with session.user available
```

This pattern avoids the temptation to throw and lose the request lifecycle; explicit return keeps it inline with the existing routes' style.

**`components/custom/admin-shell.tsx`** (new — small client wrapper)

Wraps the existing `AdminSidebar` and provides the sign-out server action. The admin layout becomes a Server Component, so any interactivity (sidebar open/close on mobile, logout button) moves into this client child. Receives the session's user info as props.

### Changed

**`app/admin/layout.tsx`** — Server Component

```ts
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import AdminShell from "@/components/custom/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/admin/login");
  return <AdminShell user={session.user}>{children}</AdminShell>;
}
```

The login route's own `layout` is not affected — `/admin/login` is `isPublicRoute` and the proxy excludes it from the auth requirement, so the layout server-side check runs only on authenticated paths. The invoice route at `/admin/orders/[id]/invoice` is also under `/admin`, so it inherits the same auth check — desired behavior (invoices contain customer info).

**`app/admin/login/page.tsx`** — full rewrite. Server action + client form:

```ts
// app/admin/login/actions.ts
"use server";
import { auth } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export async function signInWithEmail(_prev: { error: string } | null, fd: FormData) {
  const { error } = await auth.signIn.email({
    email: fd.get("email") as string,
    password: fd.get("password") as string,
  });
  if (error) return { error: error.message || "Failed to sign in" };
  redirect("/admin");
}
```

The page itself uses `useActionState` for inline error display. Styling matches the existing candy theme (`var(--candy-accent-bg)` button, rounded cards, etc.) — no Tailwind dark theme from the docs.

**`app/admin/page.tsx`, `app/admin/products/page.tsx`, `app/admin/orders/page.tsx`, `app/admin/orders/[id]/invoice/page.tsx`** — Drop the `Authorization: Bearer ${token}` header from every fetch. Cookies are sent automatically on same-origin requests. Drop all imports of `getAdminToken` / `getCurrentAdminUser`. The `useEffect` hooks no longer need to be wrapped in an async IIFE — they fall back to the simpler pre-option-2 structure (`fetch().then()`).

**`app/api/admin/products/route.ts`, `products/[id]/route.ts`, `upload/route.ts`, `orders/route.ts`, `orders/[id]/route.ts`, `orders/[id]/fulfill/route.ts`** — Replace `const user = await validateAdminToken(request); if (!user) return ...401...` with the `requireAdminSession()` two-liner.

**`app/api/images/[productId]/route.ts`** is unchanged — product images are public (catalog browsing is unauthenticated). Not under `/api/admin/`.

**`app/layout.tsx`** — Remove the `<NetlifyIdentityInit />` mount and the inline `nf-recovery-redirect` script. Drop the import.

**`package.json`**
- Add: `@neondatabase/auth`
- Remove: `netlify-identity-widget`, `@types/netlify-identity-widget`

### Deleted

- `components/custom/netlify-identity-init.tsx`
- `app/admin/recover/page.tsx`
- `lib/auth.ts` (Netlify JWT validator — no longer referenced)
- `lib/admin-auth.ts` (the helper added during the abandoned option-2 attempt)

### Pre-implementation cleanup

Several files have uncommitted local edits from the abandoned option-2 attempt (`git status` shows them). Before starting, reset these files to `main` so the diff is clean and we don't accidentally keep half-applied option-2 changes:

```
git restore app/admin/layout.tsx app/admin/page.tsx app/admin/products/page.tsx \
  app/admin/orders/page.tsx app/admin/orders/[id]/invoice/page.tsx \
  app/admin/recover/page.tsx components/custom/netlify-identity-init.tsx \
  deno.lock
rm -f lib/admin-auth.ts
```

(`recover/page.tsx` is reset and *then* deleted as part of the migration, but resetting first keeps git history sensible.)

## Bootstrap

The user creates the admin account directly in the Neon Auth dashboard. No CLI script, no signup UI shipped in the app. After this design is implemented and deployed, the first sign-in uses the credentials created in the dashboard.

## Sign-out

Sidebar's existing "Sign Out" button calls a server action:

```ts
// components/custom/admin-shell.tsx (excerpt)
async function handleLogout() {
  await signOutAction(); // server action calling auth.signOut(); redirect("/admin/login")
}
```

No `window.netlifyIdentity?.logout()`, no `sessionStorage.removeItem`. The server clears the cookie.

## Cookie behavior

Better Auth sets an httpOnly, secure (in prod), SameSite=Lax cookie containing the session. Properties:
- Not readable from JavaScript → XSS can't steal it.
- Sent automatically on same-origin fetches.
- Auto-refreshed by the SDK when near expiry on the next request.

This is strictly better than the old localStorage-by-widget arrangement.

## Error Handling

| Path | Behavior |
| --- | --- |
| User opens `/admin/products` while logged out | Proxy redirects to `/admin/login` before the page renders. No flash of empty layout. |
| API call from a logged-out client (cookie missing/expired) | `requireAdminSession()` returns 401. Page state already shows the login redirect by then in practice. |
| `auth.signIn.email` fails (bad password, unknown email) | Server action returns `{ error }`. Form renders the message inline. |
| Cookie tampered with | Better Auth rejects on signature mismatch — treated as not-logged-in. |
| Neon Auth service unreachable | `auth.getSession()` throws → page errors out with Next's default 500. Acceptable — admin tool, single user, manual retry. |

## Testing

Manual, matching project convention.

- Visit `/admin/products` in a fresh incognito window → redirected to `/admin/login`.
- Sign in with a valid dashboard-created account → land on `/admin`.
- Navigate to `/admin/products` and `/admin/orders` → data loads (cookies sent automatically).
- Open a second tab, visit `/admin/products` directly → loads without re-login (cookies are per-origin, not per-tab).
- `curl` `/api/admin/products` with no cookie → 401.
- `curl` with valid cookie (copied from a logged-in browser session) → 200 with product list.
- Sign out via the sidebar button → cookie cleared, next request to `/admin` redirects to login.
- Wait past token expiry (or shorten cookie maxAge in `.env.local` to test) → next request transparently refreshes; no user-visible failure.
- `npm run build` succeeds, `npm run lint` introduces no new errors beyond the pre-existing `setSidebarOpen` warning.

## Out of Scope (Future)

- Password reset flow within the app.
- Multi-admin support with per-user permissions or audit trail.
- Two-factor authentication.
- Sign-in via OAuth providers (Google, GitHub) — Better Auth supports these but not needed for single-owner use.
- Customizing the Neon Auth dashboard's email templates.

## Open Questions

None.
