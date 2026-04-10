# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Candy & More — a wholesale snack/candy catalog storefront built with Next.js 16. Users browse a product catalog, add items to a cart, fill in contact info (first name, last name, email, optional note), and submit. The order is emailed to the customer via Resend (SMTP). No user authentication.

**Deployment target:** Netlify

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint

## Architecture

### Pages (App Router)

Two pages only:

1. **Catalog** (`app/page.tsx`) — displays all products as cards with search and category filtering. Users add items to cart from here.
2. **Cart** (`app/cart/page.tsx`) — shows selected items, contact form (first name, last name, email, optional note), and submit button that triggers order email via Resend.

**Future:** An admin page for managing catalog listings will be added after products move to Netlify DB.

### Data

- Products currently live in `products.js` at the project root (plain JS array with id, upc, name, description, price, category, photoUrl fields).
- Product images are external/missing — use placeholder images until real images are available.
- **Future:** Products will migrate to Netlify DB with images. The data layer will be restructured at that point.

### Cart State

Cart state is client-side only (no auth, no persistence beyond the session). Use React context or a lightweight state solution — no external state management libraries.

### Component Organization

- `components/custom/` — project-specific components (Card, NavBar, Footer, etc.). Each component gets its own file.
- `components/ui/` — shadcn components (auto-managed by shadcn CLI). Do not manually edit these.
- `components/animations/` — motion library animation wrapper components.

### UI Stack

- **shadcn** (radix-nova style, RSC-enabled, Tailwind CSS variables, lucide icons) — use shadcn components (Card, Button, Input, etc.) whenever a matching primitive exists.
- **Tailwind CSS v4** with `@tailwindcss/postcss`.
- **motion** library for animations — keep animations simple and place wrappers in `components/animations/`.

### Skills

This project has skills installed in `.claude/skills/` and `.agents/skills/`. Use the appropriate skill when working on:
- Frontend design and layout
- React best practices
- shadcn component usage
- Netlify deployment and configuration
- Netlify DB integration
- Web design guidelines
