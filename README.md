# MEN'S EDIT COLLECTIONS — Inventory & Stock Management

Professional inventory management app for a men's clothing store (Shirts, Pants, T-Shirts).
Built with **Next.js 16 + Tailwind CSS**, with **Supabase** as the production database
and a **local JSON fallback** so it runs immediately on your machine.

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — login password defaults to `admin123`.

Data is stored in `.data/db.json` (auto-created). This persists across restarts.

## Going to production (Supabase + Vercel)

1. **Create a Supabase project** at https://supabase.com (free tier is fine).
2. **Run the schema**: Supabase Dashboard → SQL Editor → paste and run `supabase/schema.sql`.
3. **Create `.env.local`** in the project root:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ADMIN_PASSWORD=your-secret-password
   AUTH_SECRET=any-long-random-string
   ```

   (`SUPABASE_SERVICE_ROLE_KEY` is optional — the anon key works because the schema
   uses open RLS policies. The service key only matters if you tighten security later.)

4. **Deploy to Vercel**: import the repo, add the same env vars in
   Vercel → Project → Settings → Environment Variables, then deploy.

> Without Supabase env vars the app uses the local JSON store, which does **not**
> persist on Vercel's serverless filesystem — always configure Supabase for the
> live site.

## Features

- **Dashboard** — products, stock, sold, today's/total sales, low-stock alerts,
  7-day sales chart, recent products & activity.
- **Products** — add/edit/delete, photo upload, category (Shirt/Pant/T-Shirt),
  SKU, selling & purchase price, dynamic sizes (add/remove any size anytime).
- **One-tap selling** — tap a size → confirm → stock −1, sold +1, logged.
  Stock can never go negative.
- **Retrieve** — return accidentally-sold or customer-returned items; stock +1, sold −1.
- **Manual stock adjust** — set exact quantity per size.
- **Daily Sales** — manual revenue entries per date with week/month/overall totals,
  kept separate from item-sale revenue to avoid double counting.
- **History** — every action logged with date & time; filter by product, type, date, search.
- **Mobile-first** — bottom nav + big touch buttons on phones, sidebar on desktop.
- **Login** — single admin password (env `ADMIN_PASSWORD`, default `admin123`).

## Project structure

```
src/
  app/
    (app)/            # authenticated pages (dashboard, products, sales, history)
    api/              # REST API routes
    login/            # login page
  components/         # shared UI (toasts, dialogs, product form)
  lib/
    store.ts          # data layer — Supabase or local JSON
    types.ts          # shared types
    auth.ts           # session helpers
supabase/schema.sql   # database schema for Supabase
```
