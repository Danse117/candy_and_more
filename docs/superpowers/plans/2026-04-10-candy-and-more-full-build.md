# Candy & More — Full Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the static `index.html` wholesale catalog into a full Next.js 16 application with Resend email, Netlify deployment, Netlify DB, and an admin dashboard with Netlify Identity auth.

**Architecture:** Three-phase build. Phase 1 migrates the UI to Next.js with React context cart state and Resend email via API route. Phase 2 deploys to Netlify, provisions Netlify DB (Neon Postgres), migrates product data with a seed script, and creates an orders table. Phase 3 adds Netlify Identity authentication and a full CRUD admin dashboard for products and order viewing.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Tailwind CSS v4, shadcn (radix-nova), motion, Resend, Netlify, Netlify DB (Neon Postgres), Netlify Identity, Drizzle ORM

---

## File Structure

### Phase 1 — New files

```
app/
├── layout.tsx                          (MODIFY — add DM Sans font, CartProvider, metadata)
├── globals.css                         (MODIFY — add candy-and-more custom CSS variables)
├── page.tsx                            (REWRITE — catalog page)
├── cart/
│   └── page.tsx                        (CREATE — cart/checkout page)
├── api/
│   └── send-order/
│       └── route.ts                    (CREATE — Resend email API route)
components/
├── custom/
│   ├── navbar.tsx                      (CREATE — sticky header with search + cart button)
│   ├── category-bar.tsx                (CREATE — horizontal scrolling category filter)
│   ├── product-card.tsx                (CREATE — product display card)
│   ├── product-grid.tsx                (CREATE — grid layout with filtering logic)
│   ├── search-input.tsx                (CREATE — search bar component)
│   ├── cart-drawer.tsx                 (CREATE — slide-out cart panel)
│   ├── cart-item-row.tsx               (CREATE — single cart item with qty controls)
│   ├── inquiry-banner.tsx              (CREATE — "can't find a product?" banner)
│   └── footer.tsx                      (CREATE — site footer)
├── animations/
│   └── fade-up.tsx                     (CREATE — fade-up animation wrapper)
lib/
├── cart-context.tsx                    (CREATE — React context for cart state)
├── products.ts                        (CREATE — typed product data + helper functions)
├── types.ts                           (CREATE — shared TypeScript types)
├── email-template.ts                  (CREATE — order confirmation email HTML builder)
.env.local                              (CREATE — RESEND_API_KEY)
```

### Phase 2 — New/modified files

```
lib/
├── db/
│   ├── schema.ts                      (CREATE — Drizzle schema: products + orders tables)
│   ├── index.ts                       (CREATE — DB client/connection)
│   └── seed.ts                        (CREATE — one-time seed script from products.js)
├── products.ts                        (MODIFY — swap from static array to DB queries)
app/
├── api/
│   └── send-order/
│       └── route.ts                   (MODIFY — also insert order into DB)
drizzle.config.ts                       (CREATE — Drizzle config)
netlify.toml                            (CREATE — Netlify build config)
.env.local                              (MODIFY — add DATABASE_URL)
package.json                            (MODIFY — add drizzle-orm, @netlify/neon, dotenv)
```

### Phase 3 — New/modified files

```
app/
├── admin/
│   ├── layout.tsx                     (CREATE — admin layout with auth gate)
│   ├── page.tsx                       (CREATE — admin dashboard overview)
│   ├── products/
│   │   └── page.tsx                   (CREATE — product list + CRUD)
│   ├── orders/
│   │   └── page.tsx                   (CREATE — order list view)
│   └── login/
│       └── page.tsx                   (CREATE — admin login page)
├── api/
│   ├── admin/
│   │   ├── products/
│   │   │   └── route.ts              (CREATE — CRUD API for products)
│   │   ├── products/[id]/
│   │   │   └── route.ts              (CREATE — single product API)
│   │   ├── orders/
│   │   │   └── route.ts              (CREATE — orders list API)
│   │   └── upload/
│   │       └── route.ts              (CREATE — image upload API)
components/
├── custom/
│   ├── admin-sidebar.tsx              (CREATE — admin nav sidebar)
│   ├── product-form.tsx               (CREATE — create/edit product form)
│   ├── orders-table.tsx               (CREATE — orders data table)
│   └── image-uploader.tsx             (CREATE — drag-and-drop image upload)
lib/
├── auth.ts                            (CREATE — Netlify Identity helpers)
├── db/
│   └── schema.ts                      (MODIFY — add image_url column if needed)
```

---

# Phase 1: Website Rehaul

## Task 1: Types & Product Data Layer

**Files:**
- Create: `lib/types.ts`
- Create: `lib/products.ts`
- Modify: `products.js` (no changes — read-only reference)

- [ ] **Step 1: Create shared types**

```typescript
// lib/types.ts
export interface Product {
  id: string;
  upc: string;
  name: string;
  description: string;
  price: number;
  category: string;
  photoUrl: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface OrderPayload {
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  note?: string;
  items: Array<{
    productId: string;
    name: string;
    upc: string;
    quantity: number;
    price: number;
  }>;
  totalPrice: number;
  submittedAt: string;
}
```

- [ ] **Step 2: Create product data module**

Convert the plain JS `products.js` into a typed module. Import the raw array and re-export with helpers.

```typescript
// lib/products.ts
import type { Product } from "./types";

// Import the raw JS product array
// @ts-expect-error — products.js is untyped
import rawProducts from "../products";

export const products: Product[] = rawProducts as Product[];

export function getCategories(): string[] {
  const cats = new Map<string, number>();
  for (const p of products) {
    cats.set(p.category, (cats.get(p.category) || 0) + 1);
  }
  // Sort by count descending
  return Array.from(cats.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}

export function getCategoryCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.category, (counts.get(p.category) || 0) + 1);
  }
  return counts;
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function searchProducts(
  query: string,
  category?: string
): Product[] {
  let filtered = products;

  if (category && category !== "All") {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.upc.includes(q)
    );
  }

  return filtered.sort((a, b) => a.price - b.price);
}
```

- [ ] **Step 3: Verify the import works**

Run: `npx tsc --noEmit lib/types.ts lib/products.ts 2>&1 | head -20`
Expected: No errors (or only errors from missing tsconfig paths — acceptable at this stage).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/products.ts
git commit -m "feat: add typed product data layer and shared types"
```

---

## Task 2: Cart Context

**Files:**
- Create: `lib/cart-context.tsx`

- [ ] **Step 1: Create cart context with provider**

```typescript
// lib/cart-context.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem } from "./types";

interface CartContextValue {
  items: Map<string, number>;
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Map<string, number>>(new Map());

  const addItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = new Map(prev);
      next.set(productId, (next.get(productId) || 0) + 1);
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = new Map(prev);
      const qty = next.get(productId) || 0;
      if (qty <= 1) next.delete(productId);
      else next.set(productId, qty - 1);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      const next = new Map(prev);
      if (quantity <= 0) next.delete(productId);
      else next.set(productId, quantity);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems(new Map());
  }, []);

  const totalItems = Array.from(items.values()).reduce((a, b) => a + b, 0);

  return (
    <CartContext value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems }}>
      {children}
    </CartContext>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/cart-context.tsx
git commit -m "feat: add cart context with add/remove/clear operations"
```

---

## Task 3: Layout, Fonts & Global Styles

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Update globals.css with Candy & More design tokens**

Add the following custom properties to `:root` in `app/globals.css`, after the existing shadcn variables. These come from the `index.html` design system:

```css
/* Add inside :root block, after existing shadcn vars */
--candy-bg: #F8FAFC;
--candy-card: #FFFFFF;
--candy-text: #0F172A;
--candy-muted: #64748B;
--candy-border: #E2E8F0;
--candy-shadow: 0 10px 26px rgba(2,6,23,.08);
--candy-accent: #60A5FA;
--candy-accent-bg: rgba(96,165,250,.16);
--candy-accent-border: rgba(96,165,250,.40);
--candy-green: #34D399;
--candy-green-bg: rgba(52,211,153,.18);
--candy-green-border: rgba(52,211,153,.40);
```

Also add a `body` background gradient rule in the `@layer base` section:

```css
body {
  @apply bg-background text-foreground;
  background:
    radial-gradient(900px 520px at 12% 0%, rgba(96,165,250,.20), transparent 55%),
    radial-gradient(900px 520px at 100% 8%, rgba(52,211,153,.16), transparent 55%),
    var(--candy-bg);
}
```

- [ ] **Step 2: Update layout.tsx with DM Sans font and CartProvider**

Replace the entire `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { CartProvider } from "@/lib/cart-context";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Candy & More — Wholesale Catalog",
  description:
    "Browse our full wholesale snack and candy catalog. Search by name, description, or UPC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify the dev server starts**

Run: `npm run dev`
Expected: Server starts without errors. Page loads (still placeholder content).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: apply Candy & More design tokens, DM Sans font, and CartProvider"
```

---

## Task 4: Navbar Component

**Files:**
- Create: `components/custom/navbar.tsx`

- [ ] **Step 1: Create the navbar**

```typescript
// components/custom/navbar.tsx
"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import SearchInput from "./search-input";

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCartClick: () => void;
}

export default function Navbar({ searchQuery, onSearchChange, onCartClick }: NavbarProps) {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--candy-border)] bg-[rgba(248,250,252,0.78)] backdrop-blur-[10px]">
      <div className="mx-auto max-w-[1180px] px-4 py-4">
        <div className="flex items-center justify-between gap-3.5 flex-wrap">
          <div className="text-2xl font-black tracking-tight">
            Candy <span className="text-[var(--candy-accent)]">&</span> More
          </div>
          <div className="flex items-center gap-2.5 flex-1 justify-end min-w-[280px]">
            <SearchInput value={searchQuery} onChange={onSearchChange} />
            <Button
              variant="outline"
              onClick={onCartClick}
              className="rounded-2xl px-3.5 py-3 h-auto font-extrabold shadow-sm border-[var(--candy-border)]"
            >
              <ShoppingCart className="size-4" />
              Cart
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black">
                {totalItems}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/custom/navbar.tsx
git commit -m "feat: add sticky navbar with brand, search, and cart button"
```

---

## Task 5: Search Input Component

**Files:**
- Create: `components/custom/search-input.tsx`

- [ ] **Step 1: Create the search input**

```typescript
// components/custom/search-input.tsx
"use client";

import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="flex-1 flex items-center gap-2.5 bg-white border border-[var(--candy-border)] rounded-2xl px-3 py-3 shadow-sm transition-colors focus-within:border-[var(--candy-accent)]">
      <Search className="size-4 text-[var(--candy-muted)] shrink-0" />
      <input
        type="text"
        placeholder="Search by name, description, or UPC..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-none outline-none bg-transparent text-sm font-sans"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/custom/search-input.tsx
git commit -m "feat: add search input component"
```

---

## Task 6: Category Bar Component

**Files:**
- Create: `components/custom/category-bar.tsx`

- [ ] **Step 1: Create the category bar**

```typescript
// components/custom/category-bar.tsx
"use client";

const CATEGORY_ICONS: Record<string, string> = {
  All: "📦",
  "Gummies & Chewy Candy": "🍬",
  "Cookies & Wafers": "🍪",
  "Chips & Snacks": "🍟",
  "Chocolate Bars": "🍫",
  "Gum & Mints": "🍃",
  "Protein & Energy Bars": "💪",
  "Noodles & Soups": "🍜",
  "Rolling Papers": "📜",
  "Fragrances & Candles": "🕯️",
};

interface CategoryBarProps {
  categories: string[];
  categoryCounts: Map<string, number>;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  totalProducts: number;
}

export default function CategoryBar({
  categories,
  categoryCounts,
  activeCategory,
  onCategoryChange,
  totalProducts,
}: CategoryBarProps) {
  return (
    <div className="flex gap-2 py-3.5 overflow-x-auto scrollbar-none">
      {/* All button */}
      <button
        onClick={() => onCategoryChange("All")}
        className={`shrink-0 border rounded-xl px-3.5 py-2 text-[13px] font-bold cursor-pointer transition-all whitespace-nowrap shadow-sm ${
          activeCategory === "All"
            ? "bg-[var(--candy-accent)] border-[var(--candy-accent)] text-white shadow-[0_4px_16px_rgba(96,165,250,0.3)]"
            : "bg-white border-[var(--candy-border)] text-[var(--candy-muted)] hover:border-[var(--candy-accent)] hover:text-[var(--candy-text)]"
        }`}
      >
        📦 All <span className="ml-1.5 text-[11px] opacity-70">{totalProducts}</span>
      </button>

      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(cat)}
          className={`shrink-0 border rounded-xl px-3.5 py-2 text-[13px] font-bold cursor-pointer transition-all whitespace-nowrap shadow-sm ${
            activeCategory === cat
              ? "bg-[var(--candy-accent)] border-[var(--candy-accent)] text-white shadow-[0_4px_16px_rgba(96,165,250,0.3)]"
              : "bg-white border-[var(--candy-border)] text-[var(--candy-muted)] hover:border-[var(--candy-accent)] hover:text-[var(--candy-text)]"
          }`}
        >
          {CATEGORY_ICONS[cat] || "📦"} {cat}{" "}
          <span className="ml-1.5 text-[11px] opacity-70">{categoryCounts.get(cat) || 0}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/custom/category-bar.tsx
git commit -m "feat: add horizontal scrolling category bar with counts"
```

---

## Task 7: Product Card & Fade-Up Animation

**Files:**
- Create: `components/custom/product-card.tsx`
- Create: `components/animations/fade-up.tsx`

- [ ] **Step 1: Create fade-up animation wrapper**

```typescript
// components/animations/fade-up.tsx
"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface FadeUpProps {
  children: ReactNode;
  delay?: number;
}

export default function FadeUp({ children, delay = 0 }: FadeUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Create product card**

```typescript
// components/custom/product-card.tsx
"use client";

import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  "Gummies & Chewy Candy": "🍬",
  "Cookies & Wafers": "🍪",
  "Chips & Snacks": "🍟",
  "Chocolate Bars": "🍫",
  "Gum & Mints": "🍃",
  "Protein & Energy Bars": "💪",
  "Noodles & Soups": "🍜",
  "Rolling Papers": "📜",
  "Fragrances & Candles": "🕯️",
};

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const hasImage = product.photoUrl && product.photoUrl !== "MISSING";

  return (
    <div className="bg-[var(--candy-card)] border border-[var(--candy-border)] rounded-[20px] overflow-hidden shadow-[var(--candy-shadow)] flex flex-col transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(2,6,23,0.12)]">
      {/* Thumbnail */}
      <div className="h-[170px] bg-[#F1F5F9] flex items-center justify-center relative overflow-hidden">
        {hasImage ? (
          <img
            src={product.photoUrl}
            alt={product.name}
            className="h-full w-full object-contain p-3 transition-transform duration-200 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-col gap-2 bg-gradient-to-br from-[#E0F2FE] to-[#F0FDF4] p-4">
            <span className="text-4xl opacity-50">
              {CATEGORY_ICONS[product.category] || "📦"}
            </span>
            <span className="text-[11px] font-bold text-center text-[var(--candy-muted)] leading-tight max-w-[90%] line-clamp-2">
              {product.name}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <span className="text-[10px] px-2 py-0.5 bg-[rgba(96,165,250,0.1)] rounded-md text-[#3B82F6] font-bold self-start">
          {product.category}
        </span>
        <div className="font-black text-sm leading-tight">{product.name}</div>
        <div className="text-[var(--candy-muted)] text-xs min-h-[20px]">
          {product.description}
        </div>
        <div className="flex justify-between items-center text-[var(--candy-muted)] text-xs">
          <span className="text-[10px] px-1.5 py-0.5 bg-[rgba(100,116,139,0.08)] rounded-md font-mono">
            {product.upc}
          </span>
          <span className="text-[#16A34A] font-black">
            ${product.price.toFixed(2)}
          </span>
        </div>
        <button
          onClick={() => addItem(product.id)}
          className="mt-auto w-full border border-[var(--candy-green-border)] rounded-2xl py-2.5 px-3 cursor-pointer bg-[var(--candy-green-bg)] text-[#065F46] font-black text-sm transition-all hover:bg-[rgba(52,211,153,0.28)] hover:-translate-y-px active:translate-y-0"
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/custom/product-card.tsx components/animations/fade-up.tsx
git commit -m "feat: add product card component and fade-up animation wrapper"
```

---

## Task 8: Product Grid Component

**Files:**
- Create: `components/custom/product-grid.tsx`

- [ ] **Step 1: Create the product grid**

```typescript
// components/custom/product-grid.tsx
"use client";

import type { Product } from "@/lib/types";
import ProductCard from "./product-card";
import FadeUp from "@/components/animations/fade-up";

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-6 px-4 text-[var(--candy-muted)] text-center border border-dashed border-[rgba(100,116,139,0.35)] rounded-[20px] bg-[rgba(255,255,255,0.75)] shadow-sm">
        No products match your search.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 py-4 pb-8">
      {products.map((product, i) => (
        <FadeUp key={product.id} delay={Math.min(i * 0.015, 0.4)}>
          <ProductCard product={product} />
        </FadeUp>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/custom/product-grid.tsx
git commit -m "feat: add product grid with fade-up animations"
```

---

## Task 9: Cart Drawer & Cart Item Row

**Files:**
- Create: `components/custom/cart-item-row.tsx`
- Create: `components/custom/cart-drawer.tsx`

- [ ] **Step 1: Create cart item row**

```typescript
// components/custom/cart-item-row.tsx
"use client";

import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

interface CartItemRowProps {
  product: Product;
  quantity: number;
}

export default function CartItemRow({ product, quantity }: CartItemRowProps) {
  const { addItem, removeItem } = useCart();

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2.5 p-2.5 rounded-[14px] border-b border-[rgba(226,232,240,0.9)] last:border-b-0">
      <div>
        <strong className="text-[13px]">{product.name}</strong>
        <small className="block text-[var(--candy-muted)] mt-0.5">
          UPC: {product.upc} &bull; ${product.price.toFixed(2)} each
        </small>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => removeItem(product.id)}
          className="w-[34px] h-[34px] rounded-xl border border-[var(--candy-border)] bg-[#F8FAFC] text-[var(--candy-text)] cursor-pointer font-black transition-colors hover:border-[var(--candy-accent)]"
        >
          −
        </button>
        <div className="min-w-[26px] text-center font-black">{quantity}</div>
        <button
          onClick={() => addItem(product.id)}
          className="w-[34px] h-[34px] rounded-xl border border-[var(--candy-border)] bg-[#F8FAFC] text-[var(--candy-text)] cursor-pointer font-black transition-colors hover:border-[var(--candy-accent)]"
        >
          +
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create cart drawer**

```typescript
// components/custom/cart-drawer.tsx
"use client";

import { X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProductById } from "@/lib/products";
import { Button } from "@/components/ui/button";
import CartItemRow from "./cart-item-row";
import Link from "next/link";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, clearCart, totalItems } = useCart();

  const cartProducts = Array.from(items.entries())
    .map(([id, qty]) => ({ product: getProductById(id), quantity: qty }))
    .filter((item): item is { product: NonNullable<typeof item.product>; quantity: number } =>
      item.product !== undefined
    );

  const totalPrice = cartProducts.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-[rgba(15,23,42,0.35)] flex items-stretch justify-end z-50 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(460px,92vw)] bg-[rgba(248,250,252,0.98)] border-l border-[var(--candy-border)] p-3.5 flex flex-col gap-2.5 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-2.5">
          <h3 className="text-base font-black m-0">Your Cart</h3>
          <Button variant="outline" size="icon-sm" onClick={onClose} className="rounded-[14px]">
            <X className="size-4" />
          </Button>
        </div>

        {/* Items */}
        <div className="overflow-auto border border-[var(--candy-border)] rounded-[18px] bg-white p-2.5 min-h-[180px] max-h-[48vh] shadow-sm">
          {cartProducts.length === 0 ? (
            <div className="text-[var(--candy-muted)] p-4 text-center">
              Your cart is empty.
            </div>
          ) : (
            cartProducts.map(({ product, quantity }) => (
              <CartItemRow key={product.id} product={product} quantity={quantity} />
            ))
          )}
        </div>

        {/* Totals */}
        <div className="border border-[var(--candy-border)] rounded-[18px] p-3 bg-white shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center text-[var(--candy-muted)] text-[13px]">
            <span>Items</span>
            <b className="text-[var(--candy-text)]">{totalItems}</b>
          </div>
          <div className="flex justify-between items-center text-[var(--candy-muted)] text-[13px]">
            <span>Estimated total</span>
            <b className="text-[var(--candy-text)]">${totalPrice.toFixed(2)}</b>
          </div>

          <div className="flex gap-2.5 mt-2">
            <button
              onClick={clearCart}
              className="rounded-2xl py-3 px-3 cursor-pointer bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.30)] text-[#7F1D1D] font-black min-w-[120px] transition-colors hover:bg-[rgba(239,68,68,0.20)]"
            >
              Clear
            </button>
            <Link
              href="/cart"
              onClick={onClose}
              className="flex-1 rounded-2xl py-3 px-3 cursor-pointer bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] text-center no-underline"
            >
              Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/custom/cart-item-row.tsx components/custom/cart-drawer.tsx
git commit -m "feat: add cart drawer with item rows and totals"
```

---

## Task 10: Inquiry Banner & Footer

**Files:**
- Create: `components/custom/inquiry-banner.tsx`
- Create: `components/custom/footer.tsx`

- [ ] **Step 1: Create inquiry banner**

```typescript
// components/custom/inquiry-banner.tsx
"use client";

import { useState } from "react";

export default function InquiryBanner() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");

  function handleSend() {
    const subject = encodeURIComponent("Product Inquiry");
    const body = encodeURIComponent(
      `Name: ${name}\nContact: ${email}\n\nInquiry: ${text}`
    );
    window.location.href = `mailto:candiesandmoredistrocorp@gmail.com?subject=${subject}&body=${body}`;
  }

  return (
    <div className="my-3.5">
      <div className="bg-[rgba(255,255,255,0.85)] border border-[var(--candy-border)] rounded-[20px] shadow-sm p-3.5">
        <div className="flex gap-3.5 items-start justify-between flex-wrap">
          <div className="min-w-[240px] flex-1">
            <div className="font-[950] text-sm">Can&apos;t find a product?</div>
            <div className="text-[var(--candy-muted)] text-xs leading-snug mt-1">
              Send us a quick inquiry and we&apos;ll tell you if we have it in stock or can get it for you.
            </div>
          </div>
          <div className="flex gap-2.5 items-center flex-wrap justify-end">
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-[13px] min-w-[170px]"
            />
            <input
              placeholder="Email or phone"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-[13px] min-w-[190px]"
            />
          </div>
        </div>
        <div className="mt-2.5 flex gap-2.5 flex-wrap items-center">
          <input
            placeholder="What product are you looking for? (name, brand, size, flavor, UPC, etc.)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-[13px] min-w-[260px]"
          />
          <button
            onClick={handleSend}
            className="shrink-0 border border-[var(--candy-border)] bg-white rounded-2xl py-3 px-3.5 cursor-pointer shadow-sm font-[950] text-sm transition-all hover:border-[var(--candy-accent)] hover:-translate-y-px"
          >
            Send inquiry ✉️
          </button>
        </div>
        <div className="text-[var(--candy-muted)] text-[11px] mt-2">
          This opens your email app with the inquiry pre‑filled.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create footer**

```typescript
// components/custom/footer.tsx
export default function Footer() {
  return (
    <footer className="border-t border-[var(--candy-border)] text-[var(--candy-muted)] p-4 text-center text-xs mt-auto">
      Candy &amp; More &bull; Wholesale Catalog
    </footer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/custom/inquiry-banner.tsx components/custom/footer.tsx
git commit -m "feat: add inquiry banner and footer components"
```

---

## Task 11: Catalog Page (Home)

**Files:**
- Rewrite: `app/page.tsx`

- [ ] **Step 1: Build the catalog page**

```typescript
// app/page.tsx
"use client";

import { useState } from "react";
import { products, getCategories, getCategoryCounts, searchProducts } from "@/lib/products";
import Navbar from "@/components/custom/navbar";
import CategoryBar from "@/components/custom/category-bar";
import ProductGrid from "@/components/custom/product-grid";
import InquiryBanner from "@/components/custom/inquiry-banner";
import CartDrawer from "@/components/custom/cart-drawer";
import Footer from "@/components/custom/footer";

export default function CatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);

  const categories = getCategories();
  const categoryCounts = getCategoryCounts();
  const filteredProducts = searchProducts(searchQuery, activeCategory);

  return (
    <>
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-[1180px] px-4">
        {/* Hero */}
        <div className="pt-2.5">
          <h2 className="my-2 text-[22px] font-black">Wholesale Catalog</h2>
          <p className="m-0 text-[var(--candy-muted)] leading-snug">
            Browse our full selection by category. Search by name, description, or UPC.
          </p>
        </div>

        {/* Category filter */}
        <CategoryBar
          categories={categories}
          categoryCounts={categoryCounts}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          totalProducts={products.length}
        />

        {/* Inquiry banner */}
        <InquiryBanner />

        {/* Product grid */}
        <ProductGrid products={filteredProducts} />
      </main>

      <Footer />

      {/* Cart drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev`
Open: `http://localhost:3000`
Expected: Full catalog page with products, search, category filtering, cart functionality.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: build catalog page with search, categories, and cart drawer"
```

---

## Task 12: Resend Email API Route

**Files:**
- Create: `app/api/send-order/route.ts`
- Create: `lib/email-template.ts`
- Create: `.env.local`

- [ ] **Step 1: Install Resend**

```bash
npm install resend
```

- [ ] **Step 2: Create .env.local**

```
RESEND_API_KEY=re_your_api_key_here
```

- [ ] **Step 3: Configure next.config.ts for remote images**

Update `next.config.ts` to allow Amazon images (used in some product photoUrls):

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create email template builder**

```typescript
// lib/email-template.ts
import type { OrderPayload } from "./types";

export function buildOrderConfirmationHtml(order: OrderPayload): string {
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px;">${item.name}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px; font-family:monospace;">${item.upc}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px; text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px; border-bottom:1px solid #E2E8F0; font-size:14px; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:'DM Sans',system-ui,sans-serif; max-width:600px; margin:0 auto; background:#F8FAFC; padding:24px;">
      <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; overflow:hidden;">
        <div style="padding:24px; border-bottom:1px solid #E2E8F0;">
          <h1 style="margin:0; font-size:20px; font-weight:900;">
            Candy <span style="color:#60A5FA;">&</span> More
          </h1>
          <p style="margin:8px 0 0; color:#64748B; font-size:14px;">Order Confirmation</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px; font-size:14px;">
            Hi <strong>${order.customerFirstName}</strong>, thank you for your order!
          </p>
          ${order.note ? `<p style="margin:0 0 16px; font-size:14px; color:#64748B;"><em>Note: ${order.note}</em></p>` : ""}
          <table style="width:100%; border-collapse:collapse; margin:16px 0;">
            <thead>
              <tr style="background:#F1F5F9;">
                <th style="padding:8px 12px; text-align:left; font-size:12px; font-weight:700; color:#64748B;">Product</th>
                <th style="padding:8px 12px; text-align:left; font-size:12px; font-weight:700; color:#64748B;">UPC</th>
                <th style="padding:8px 12px; text-align:center; font-size:12px; font-weight:700; color:#64748B;">Qty</th>
                <th style="padding:8px 12px; text-align:right; font-size:12px; font-weight:700; color:#64748B;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="text-align:right; font-size:16px; font-weight:900; padding:12px; background:#F0FDF4; border-radius:12px; border:1px solid rgba(52,211,153,0.4);">
            Total: $${order.totalPrice.toFixed(2)}
          </div>
        </div>
        <div style="padding:16px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; font-size:12px; color:#64748B; text-align:center;">
          We'll be in touch soon to confirm availability and arrange delivery.
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 5: Create the API route**

```typescript
// app/api/send-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { OrderPayload } from "@/lib/types";
import { buildOrderConfirmationHtml } from "@/lib/email-template";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body: OrderPayload = await request.json();

    // Validate required fields
    if (!body.customerFirstName || !body.customerLastName || !body.customerEmail) {
      return NextResponse.json(
        { error: "Missing required customer information" },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    const html = buildOrderConfirmationHtml(body);

    const { error } = await resend.emails.send({
      from: "Candy & More <orders@yourdomain.com>",
      to: body.customerEmail,
      subject: `Order Confirmation — Candy & More`,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to send order email" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/send-order/route.ts lib/email-template.ts next.config.ts
# Do NOT commit .env.local
git commit -m "feat: add Resend email API route with order confirmation template"
```

---

## Task 13: Cart / Checkout Page

**Files:**
- Create: `app/cart/page.tsx`

- [ ] **Step 1: Build the cart/checkout page**

```typescript
// app/cart/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProductById } from "@/lib/products";
import CartItemRow from "@/components/custom/cart-item-row";
import Footer from "@/components/custom/footer";
import type { OrderPayload } from "@/lib/types";

export default function CartPage() {
  const { items, clearCart, totalItems } = useCart();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const cartProducts = Array.from(items.entries())
    .map(([id, qty]) => ({ product: getProductById(id), quantity: qty }))
    .filter((item): item is { product: NonNullable<typeof item.product>; quantity: number } =>
      item.product !== undefined
    );

  const totalPrice = cartProducts.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (cartProducts.length === 0) {
      setErrorMessage("Your cart is empty.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setErrorMessage("");

    const payload: OrderPayload = {
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: email,
      note: note || undefined,
      items: cartProducts.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        upc: product.upc,
        quantity,
        price: product.price,
      })),
      totalPrice,
      submittedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/send-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit order");
      }

      setStatus("success");
      clearCart();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-[var(--candy-border)] bg-[rgba(248,250,252,0.78)] backdrop-blur-[10px]">
        <div className="mx-auto max-w-[1180px] px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-[var(--candy-muted)] hover:text-[var(--candy-text)] transition-colors no-underline"
            >
              <ArrowLeft className="size-4" />
              Back to catalog
            </Link>
            <div className="text-2xl font-black tracking-tight ml-auto">
              Candy <span className="text-[var(--candy-accent)]">&</span> More
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-4 py-8">
        <h1 className="text-2xl font-black mb-6">Checkout</h1>

        {status === "success" ? (
          <div className="border border-[var(--candy-green-border)] bg-[var(--candy-green-bg)] rounded-[20px] p-8 text-center">
            <h2 className="text-xl font-black text-[#065F46] mb-2">Order Submitted!</h2>
            <p className="text-[#065F46] text-sm">
              A confirmation email has been sent. We&apos;ll be in touch soon.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 rounded-2xl py-3 px-6 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black no-underline transition-colors hover:bg-[rgba(96,165,250,0.28)]"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="border border-[var(--candy-border)] rounded-[18px] bg-white p-3 shadow-sm mb-6">
              {cartProducts.length === 0 ? (
                <div className="text-[var(--candy-muted)] p-6 text-center">
                  Your cart is empty.{" "}
                  <Link href="/" className="text-[var(--candy-accent)] underline">
                    Browse products
                  </Link>
                </div>
              ) : (
                cartProducts.map(({ product, quantity }) => (
                  <CartItemRow key={product.id} product={product} quantity={quantity} />
                ))
              )}
            </div>

            {/* Totals */}
            {cartProducts.length > 0 && (
              <div className="border border-[var(--candy-border)] rounded-[18px] p-4 bg-white shadow-sm mb-6">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-[var(--candy-muted)]">Items</span>
                  <b>{totalItems}</b>
                </div>
                <div className="flex justify-between items-center text-base">
                  <span className="text-[var(--candy-muted)]">Estimated total</span>
                  <b className="text-lg font-black">${totalPrice.toFixed(2)}</b>
                </div>
              </div>
            )}

            {/* Contact form */}
            <form onSubmit={handleSubmit}>
              <div className="border border-[var(--candy-border)] rounded-[18px] p-4 bg-white shadow-sm mb-6">
                <h3 className="text-sm font-black mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    required
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full"
                  />
                  <input
                    required
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full"
                  />
                </div>
                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-3 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full"
                />
                <textarea
                  placeholder="Add a note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="mt-3 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full resize-none"
                />
              </div>

              {status === "error" && errorMessage && (
                <div className="text-[#B00020] text-sm mb-4 px-1">{errorMessage}</div>
              )}

              <button
                type="submit"
                disabled={status === "sending" || cartProducts.length === 0}
                className="w-full rounded-2xl py-3.5 px-4 cursor-pointer bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] font-black text-base transition-all hover:bg-[rgba(52,211,153,0.28)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "sending" ? "Sending..." : "Submit Order"}
              </button>
            </form>
          </>
        )}
      </main>

      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Verify the full flow**

Run: `npm run dev`
1. Browse products at `/`
2. Add items to cart, open cart drawer
3. Click "Checkout" — navigates to `/cart`
4. See items, fill in contact form
5. Submit (will fail without valid Resend API key — that's expected)

- [ ] **Step 3: Commit**

```bash
git add app/cart/page.tsx
git commit -m "feat: build cart/checkout page with contact form and order submission"
```

---

## Task 14: Production Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: No errors. Fix any issues found.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds. Fix any type errors or build issues.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and build issues from Phase 1"
```

---

# Phase 2: Deployment & Database

## Task 15: Netlify Configuration

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Create Netlify config**

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- [ ] **Step 2: Install Netlify Next.js plugin**

```bash
npm install -D @netlify/plugin-nextjs
```

- [ ] **Step 3: Commit**

```bash
git add netlify.toml package.json package-lock.json
git commit -m "feat: add Netlify deployment configuration"
```

---

## Task 16: Deploy to Netlify

**Files:** None (CLI operations)

- [ ] **Step 1: Install Netlify CLI**

```bash
npm install -g netlify-cli
```

- [ ] **Step 2: Log in and initialize**

```bash
netlify login
netlify init
```

Follow the prompts to connect to a Netlify site.

- [ ] **Step 3: Deploy preview**

```bash
netlify deploy
```

Verify the preview URL works.

- [ ] **Step 4: Deploy to production**

```bash
netlify deploy --prod
```

- [ ] **Step 5: Set environment variables in Netlify**

```bash
netlify env:set RESEND_API_KEY "re_your_actual_key"
```

---

## Task 17: Database Schema (Drizzle + Netlify DB)

**Files:**
- Create: `lib/db/schema.ts`
- Create: `lib/db/index.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install drizzle-orm @netlify/neon
npm install -D drizzle-kit dotenv
```

- [ ] **Step 2: Create database schema**

```typescript
// lib/db/schema.ts
import { pgTable, text, numeric, timestamp, integer, serial } from "drizzle-orm/pg-core";

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
```

- [ ] **Step 3: Create DB client**

```typescript
// lib/db/index.ts
import { neon } from "@netlify/neon";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}
```

- [ ] **Step 4: Create Drizzle config**

```typescript
// drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/index.ts drizzle.config.ts package.json package-lock.json
git commit -m "feat: add Drizzle schema with products and orders tables"
```

---

## Task 18: Provision Netlify DB & Run Migration

**Files:** None (CLI operations)

- [ ] **Step 1: Enable Netlify DB extension**

In the Netlify dashboard, go to your site → Extensions → Enable "Neon Postgres". This provisions a database and adds `DATABASE_URL` to your environment variables.

- [ ] **Step 2: Pull environment variables locally**

```bash
netlify env:pull
```

This creates/updates `.env.local` with `DATABASE_URL`.

- [ ] **Step 3: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: Tables `products` and `orders` are created in the database.

---

## Task 19: Seed Script

**Files:**
- Create: `lib/db/seed.ts`

- [ ] **Step 1: Create the seed script**

```typescript
// lib/db/seed.ts
import "dotenv/config";
import { neon } from "@netlify/neon";
import { drizzle } from "drizzle-orm/neon-http";
import { productsTable } from "./schema";

// @ts-expect-error — products.js is untyped
import rawProducts from "../../products";

interface RawProduct {
  id: string;
  upc: string;
  name: string;
  description: string;
  price: number;
  category: string;
  photoUrl: string;
}

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const products = rawProducts as RawProduct[];
  console.log(`Seeding ${products.length} products...`);

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await db.insert(productsTable).values(
      batch.map((p) => ({
        id: p.id,
        upc: p.upc,
        name: p.name,
        description: p.description || "",
        price: p.price.toFixed(2),
        category: p.category,
        photoUrl: p.photoUrl || "MISSING",
      }))
    );
    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, products.length)} / ${products.length}`);
  }

  console.log("Seeding complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add seed script to package.json**

Add to the `"scripts"` section:

```json
"db:seed": "npx tsx lib/db/seed.ts"
```

- [ ] **Step 3: Run the seed**

```bash
npm run db:seed
```

Expected: All 525 products inserted into the database.

- [ ] **Step 4: Commit**

```bash
git add lib/db/seed.ts package.json
git commit -m "feat: add one-time database seed script from products.js"
```

---

## Task 20: Swap Data Layer to DB

**Files:**
- Modify: `lib/products.ts`
- Modify: `app/api/send-order/route.ts`

- [ ] **Step 1: Update products.ts to fetch from DB**

Replace the static import with DB queries. Keep the same exported interface so consumers don't change:

```typescript
// lib/products.ts
import type { Product } from "./types";
import { getDb } from "./db";
import { productsTable } from "./db/schema";
import { eq, ilike, or, asc } from "drizzle-orm";

export async function getProducts(): Promise<Product[]> {
  const db = getDb();
  const rows = await db.select().from(productsTable).orderBy(asc(productsTable.price));
  return rows.map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const db = getDb();
  const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  return row ? rowToProduct(row) : undefined;
}

export async function getCategories(): Promise<string[]> {
  const products = await getProducts();
  const cats = new Map<string, number>();
  for (const p of products) {
    cats.set(p.category, (cats.get(p.category) || 0) + 1);
  }
  return Array.from(cats.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}

export async function getCategoryCounts(): Promise<Map<string, number>> {
  const products = await getProducts();
  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.category, (counts.get(p.category) || 0) + 1);
  }
  return counts;
}

export async function searchProducts(
  query: string,
  category?: string
): Promise<Product[]> {
  const products = await getProducts();
  let filtered = products;

  if (category && category !== "All") {
    filtered = filtered.filter((p) => p.category === category);
  }

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.upc.includes(q)
    );
  }

  return filtered;
}

function rowToProduct(row: typeof productsTable.$inferSelect): Product {
  return {
    id: row.id,
    upc: row.upc,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    photoUrl: row.photoUrl,
  };
}
```

- [ ] **Step 2: Update catalog page to use async data**

Since the product functions are now async, the catalog page needs to be restructured. Convert `app/page.tsx` to a server component that fetches data and passes it to a client component:

Create `components/custom/catalog-client.tsx` with the existing client-side logic (search, category, cart drawer state), receiving `products` and `categories` as props.

Update `app/page.tsx` to:

```typescript
// app/page.tsx
import { getProducts, getCategories, getCategoryCounts } from "@/lib/products";
import CatalogClient from "@/components/custom/catalog-client";

export default async function CatalogPage() {
  const [products, categories, categoryCounts] = await Promise.all([
    getProducts(),
    getCategories(),
    getCategoryCounts(),
  ]);

  // Serialize Map to plain object for client component
  const categoryCountsObj = Object.fromEntries(categoryCounts);

  return (
    <CatalogClient
      products={products}
      categories={categories}
      categoryCounts={categoryCountsObj}
    />
  );
}
```

Then create `components/custom/catalog-client.tsx` with the client-side filtering logic (move the current page.tsx body there, adjusted to receive products as props instead of importing them, and handle `categoryCounts` as a plain object).

- [ ] **Step 3: Update send-order route to save orders**

Add order persistence to the API route:

```typescript
// Add to app/api/send-order/route.ts, after sending email:
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";

// Inside the POST handler, after successful email send:
const db = getDb();
await db.insert(ordersTable).values({
  customerFirstName: body.customerFirstName,
  customerLastName: body.customerLastName,
  customerEmail: body.customerEmail,
  note: body.note || null,
  items: JSON.stringify(body.items),
  totalPrice: body.totalPrice.toFixed(2),
  submittedAt: new Date(body.submittedAt),
});
```

- [ ] **Step 4: Verify locally**

Run: `npm run dev`
Expected: Products load from the database. Cart and checkout still work. Orders are saved to DB.

- [ ] **Step 5: Commit and deploy**

```bash
git add lib/products.ts app/page.tsx app/api/send-order/route.ts components/custom/catalog-client.tsx
git commit -m "feat: swap product data layer from static JS to Netlify DB"
netlify deploy --prod
```

---

# Phase 3: Admin Dashboard

## Task 21: Netlify Identity Setup

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: Enable Netlify Identity**

In the Netlify dashboard: Site → Integrations → Identity → Enable. Set registration to "Invite only". Invite yourself as admin.

- [ ] **Step 2: Install Netlify Identity widget**

```bash
npm install netlify-identity-widget
npm install -D @types/netlify-identity-widget
```

- [ ] **Step 3: Create auth helpers**

```typescript
// lib/auth.ts
import type { NextRequest } from "next/server";

interface NetlifyIdentityUser {
  sub: string;
  email: string;
  app_metadata?: {
    roles?: string[];
  };
}

export async function validateAdminToken(request: NextRequest): Promise<NetlifyIdentityUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  try {
    // Decode JWT payload (Netlify Identity tokens are JWTs)
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf-8")
    ) as NetlifyIdentityUser;

    // Check for admin role
    const roles = payload.app_metadata?.roles || [];
    if (!roles.includes("admin")) return null;

    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts package.json package-lock.json
git commit -m "feat: add Netlify Identity auth helpers"
```

---

## Task 22: Admin Login Page

**Files:**
- Create: `app/admin/login/page.tsx`

- [ ] **Step 1: Create admin login page**

```typescript
// app/admin/login/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminLoginPage() {
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    import("netlify-identity-widget").then((netlifyIdentity) => {
      netlifyIdentity.default.init();
      setReady(true);

      netlifyIdentity.default.on("login", (user) => {
        // Store token and redirect
        const token = user?.token?.access_token;
        if (token) {
          sessionStorage.setItem("nf_token", token);
          window.location.href = "/admin";
        }
      });
    });
  }, []);

  function handleLogin() {
    import("netlify-identity-widget").then((netlifyIdentity) => {
      netlifyIdentity.default.open("login");
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white border border-[var(--candy-border)] rounded-[20px] shadow-[var(--candy-shadow)] p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-black mb-2">
          Candy <span className="text-[var(--candy-accent)]">&</span> More
        </h1>
        <p className="text-[var(--candy-muted)] text-sm mb-6">Admin Dashboard</p>
        <button
          onClick={handleLogin}
          disabled={!ready}
          className="w-full rounded-2xl py-3 px-4 bg-[var(--candy-accent-bg)] border border-[var(--candy-accent-border)] text-[#0B3B66] font-black transition-colors hover:bg-[rgba(96,165,250,0.28)] disabled:opacity-50"
        >
          {ready ? "Sign In" : "Loading..."}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat: add admin login page with Netlify Identity"
```

---

## Task 23: Admin Layout with Auth Gate

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `components/custom/admin-sidebar.tsx`

- [ ] **Step 1: Create admin sidebar**

```typescript
// components/custom/admin-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, LogOut } from "lucide-react";

interface AdminSidebarProps {
  onLogout: () => void;
}

export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Dashboard", icon: Package },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  ];

  return (
    <aside className="w-[240px] bg-white border-r border-[var(--candy-border)] p-4 flex flex-col h-full">
      <div className="text-lg font-black mb-6">
        Candy <span className="text-[var(--candy-accent)]">&</span> More
      </div>
      <p className="text-[10px] font-bold text-[var(--candy-muted)] uppercase tracking-wider mb-3">
        Admin
      </p>
      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold no-underline transition-colors ${
              pathname === href
                ? "bg-[var(--candy-accent-bg)] text-[#0B3B66]"
                : "text-[var(--candy-muted)] hover:text-[var(--candy-text)] hover:bg-[#F1F5F9]"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={onLogout}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-[var(--candy-muted)] hover:text-[#7F1D1D] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
      >
        <LogOut className="size-4" />
        Sign Out
      </button>
    </aside>
  );
}
```

- [ ] **Step 2: Create admin layout with auth gate**

```typescript
// app/admin/layout.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/custom/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setAuthenticated(true);
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("nf_token");
    import("netlify-identity-widget").then((netlifyIdentity) => {
      netlifyIdentity.default.logout();
    });
    router.replace("/admin/login");
  }

  if (!authenticated) return null;

  return (
    <div className="flex h-screen">
      <AdminSidebar onLogout={handleLogout} />
      <main className="flex-1 overflow-auto p-6 bg-[var(--candy-bg)]">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx components/custom/admin-sidebar.tsx
git commit -m "feat: add admin layout with sidebar and auth gate"
```

---

## Task 24: Admin Product CRUD API

**Files:**
- Create: `app/api/admin/products/route.ts`
- Create: `app/api/admin/products/[id]/route.ts`

- [ ] **Step 1: Create products list/create API**

```typescript
// app/api/admin/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productsTable } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const products = await db.select().from(productsTable).orderBy(asc(productsTable.name));
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const db = getDb();

  const id = `upc_${body.upc}`;
  await db.insert(productsTable).values({
    id,
    upc: body.upc,
    name: body.name,
    description: body.description || "",
    price: Number(body.price).toFixed(2),
    category: body.category,
    photoUrl: body.photoUrl || "MISSING",
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
```

- [ ] **Step 2: Create single product API (update/delete)**

```typescript
// app/api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  await db
    .update(productsTable)
    .set({
      name: body.name,
      upc: body.upc,
      description: body.description || "",
      price: Number(body.price).toFixed(2),
      category: body.category,
      photoUrl: body.photoUrl || "MISSING",
      updatedAt: new Date(),
    })
    .where(eq(productsTable.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  await db.delete(productsTable).where(eq(productsTable.id, id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/products/route.ts app/api/admin/products/\[id\]/route.ts
git commit -m "feat: add admin CRUD API routes for products"
```

---

## Task 25: Admin Orders API

**Files:**
- Create: `app/api/admin/orders/route.ts`

- [ ] **Step 1: Create orders list API**

```typescript
// app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ordersTable } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt));

  return NextResponse.json(orders);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/orders/route.ts
git commit -m "feat: add admin orders list API route"
```

---

## Task 26: Image Upload API

**Files:**
- Create: `app/api/admin/upload/route.ts`

- [ ] **Step 1: Create upload route**

This stores images in the `public/images/` directory, named by product UPC:

```typescript
// app/api/admin/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  const user = await validateAdminToken(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const productId = formData.get("productId") as string | null;

  if (!file || !productId) {
    return NextResponse.json({ error: "Missing file or productId" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${productId}.${ext}`;
  const dir = path.join(process.cwd(), "public", "images");

  await mkdir(dir, { recursive: true });

  const bytes = await file.arrayBuffer();
  await writeFile(path.join(dir, filename), Buffer.from(bytes));

  const url = `/images/${filename}`;
  return NextResponse.json({ ok: true, url });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/upload/route.ts
git commit -m "feat: add image upload API for product photos"
```

---

## Task 27: Admin Dashboard Overview Page

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create dashboard overview**

```typescript
// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingCart } from "lucide-react";

interface Stats {
  productCount: number;
  orderCount: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ productCount: 0, orderCount: 0 });

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch("/api/admin/products", { headers }).then((r) => r.json()),
      fetch("/api/admin/orders", { headers }).then((r) => r.json()),
    ]).then(([products, orders]) => {
      setStats({
        productCount: Array.isArray(products) ? products.length : 0,
        orderCount: Array.isArray(orders) ? orders.length : 0,
      });
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Package className="size-5 text-[var(--candy-accent)]" />
            <span className="text-sm font-bold text-[var(--candy-muted)]">Products</span>
          </div>
          <div className="text-3xl font-black">{stats.productCount}</div>
        </div>
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="size-5 text-[var(--candy-green)]" />
            <span className="text-sm font-bold text-[var(--candy-muted)]">Orders</span>
          </div>
          <div className="text-3xl font-black">{stats.orderCount}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add admin dashboard overview with stats"
```

---

## Task 28: Admin Products Page (Full CRUD UI)

**Files:**
- Create: `app/admin/products/page.tsx`
- Create: `components/custom/product-form.tsx`
- Create: `components/custom/image-uploader.tsx`

- [ ] **Step 1: Create image uploader component**

```typescript
// components/custom/image-uploader.tsx
"use client";

import { useState, useRef } from "react";
import { Upload } from "lucide-react";

interface ImageUploaderProps {
  productId: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
}

export default function ImageUploader({ productId, currentUrl, onUploaded }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);

    const token = sessionStorage.getItem("nf_token");
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      onUploaded(data.url);
    }
    setUploading(false);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-[var(--candy-border)] rounded-xl p-4 text-center cursor-pointer hover:border-[var(--candy-accent)] transition-colors"
    >
      {currentUrl && currentUrl !== "MISSING" ? (
        <img src={currentUrl} alt="Product" className="max-h-[120px] mx-auto mb-2 object-contain" />
      ) : (
        <Upload className="size-8 mx-auto mb-2 text-[var(--candy-muted)]" />
      )}
      <p className="text-xs text-[var(--candy-muted)]">
        {uploading ? "Uploading..." : "Click to upload image"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create product form component**

```typescript
// components/custom/product-form.tsx
"use client";

import { useState } from "react";
import ImageUploader from "./image-uploader";

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
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
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

      {form.id && (
        <ImageUploader
          productId={form.id}
          currentUrl={form.photoUrl}
          onUploaded={(url) => setForm({ ...form, photoUrl: url })}
        />
      )}

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

- [ ] **Step 3: Create admin products page**

```typescript
// app/admin/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import ProductForm from "@/components/custom/product-form";

interface Product {
  id: string;
  upc: string;
  name: string;
  description: string;
  price: string;
  category: string;
  photo_url: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const token = typeof window !== "undefined" ? sessionStorage.getItem("nf_token") : null;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function loadProducts() {
    const res = await fetch("/api/admin/products", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setProducts(await res.json());
  }

  useEffect(() => {
    loadProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(data: { upc: string; name: string; description: string; price: string; category: string; photoUrl: string }) {
    await fetch("/api/admin/products", {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    setCreating(false);
    loadProducts();
  }

  async function handleUpdate(data: { id?: string; upc: string; name: string; description: string; price: string; category: string; photoUrl: string }) {
    if (!data.id) return;
    await fetch(`/api/admin/products/${data.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });
    setEditing(null);
    loadProducts();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadProducts();
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.upc.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Products</h1>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-1.5 rounded-2xl py-2.5 px-4 bg-[var(--candy-green-bg)] border border-[var(--candy-green-border)] text-[#065F46] font-black text-sm transition-colors hover:bg-[rgba(52,211,153,0.28)]"
        >
          <Plus className="size-4" /> New Product
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-4 shadow-sm mb-6">
          <h3 className="text-sm font-black mb-3">
            {creating ? "Create Product" : "Edit Product"}
          </h3>
          <ProductForm
            initial={
              editing
                ? {
                    id: editing.id,
                    upc: editing.upc,
                    name: editing.name,
                    description: editing.description,
                    price: editing.price,
                    category: editing.category,
                    photoUrl: editing.photo_url,
                  }
                : undefined
            }
            onSave={editing ? handleUpdate : handleCreate}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </div>
      )}

      <input
        placeholder="Search products..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 border border-[var(--candy-border)] rounded-[14px] py-2.5 px-3 bg-white text-sm w-full max-w-sm"
      />

      <div className="bg-white border border-[var(--candy-border)] rounded-[18px] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F1F5F9] text-left">
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)]">Name</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)]">UPC</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)]">Category</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)] text-right">Price</th>
              <th className="px-4 py-3 font-bold text-[var(--candy-muted)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-[var(--candy-border)]">
                <td className="px-4 py-3 font-bold">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--candy-muted)]">{p.upc}</td>
                <td className="px-4 py-3">{p.category}</td>
                <td className="px-4 py-3 text-right text-[#16A34A] font-bold">${Number(p.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => { setEditing(p); setCreating(false); }}
                      className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
                    >
                      <Pencil className="size-4 text-[var(--candy-muted)]" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.08)] transition-colors"
                    >
                      <Trash2 className="size-4 text-[#EF4444]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-[var(--candy-muted)]">No products found.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/products/page.tsx components/custom/product-form.tsx components/custom/image-uploader.tsx
git commit -m "feat: add admin products page with full CRUD and image upload"
```

---

## Task 29: Admin Orders Page

**Files:**
- Create: `app/admin/orders/page.tsx`

- [ ] **Step 1: Create orders page**

```typescript
// app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Order {
  id: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  note: string | null;
  items: string; // JSON string
  total_price: string;
  submitted_at: string;
  created_at: string;
}

interface OrderItem {
  name: string;
  upc: string;
  quantity: number;
  price: number;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("nf_token");
    fetch("/api/admin/orders", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
      });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Orders</h1>

      {orders.length === 0 ? (
        <div className="bg-white border border-[var(--candy-border)] rounded-[18px] p-8 text-center text-[var(--candy-muted)] shadow-sm">
          No orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items: OrderItem[] = JSON.parse(order.items);
            const isExpanded = expanded === order.id;

            return (
              <div
                key={order.id}
                className="bg-white border border-[var(--candy-border)] rounded-[18px] shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F8FAFC] transition-colors"
                >
                  <div>
                    <div className="font-bold text-sm">
                      {order.customer_first_name} {order.customer_last_name}
                    </div>
                    <div className="text-xs text-[var(--candy-muted)]">
                      {order.customer_email} &bull;{" "}
                      {new Date(order.submitted_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-[#16A34A]">
                      ${Number(order.total_price).toFixed(2)}
                    </div>
                    <div className="text-xs text-[var(--candy-muted)]">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[var(--candy-border)] p-4">
                    {order.note && (
                      <p className="text-sm text-[var(--candy-muted)] mb-3 italic">
                        Note: {order.note}
                      </p>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--candy-muted)]">
                          <th className="pb-2 font-bold text-xs">Product</th>
                          <th className="pb-2 font-bold text-xs">UPC</th>
                          <th className="pb-2 font-bold text-xs text-center">Qty</th>
                          <th className="pb-2 font-bold text-xs text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <tr key={i} className="border-t border-[rgba(226,232,240,0.5)]">
                            <td className="py-2">{item.name}</td>
                            <td className="py-2 font-mono text-xs text-[var(--candy-muted)]">
                              {item.upc}
                            </td>
                            <td className="py-2 text-center">{item.quantity}</td>
                            <td className="py-2 text-right font-bold">
                              ${(item.price * item.quantity).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/orders/page.tsx
git commit -m "feat: add admin orders page with expandable order details"
```

---

## Task 30: Final Build Verification & Deploy

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any issues.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Fix any errors.

- [ ] **Step 3: Test locally**

```bash
npm run start
```

Verify:
1. Catalog page loads products from DB
2. Search and category filtering work
3. Cart add/remove/clear works
4. Checkout flow submits order, sends email, saves to DB
5. Admin login works at `/admin/login`
6. Admin dashboard shows product/order counts
7. Admin products page: create, edit, delete, upload image
8. Admin orders page: view orders with details

- [ ] **Step 4: Commit any fixes and deploy**

```bash
git add -A
git commit -m "fix: resolve final build issues"
netlify deploy --prod
```
