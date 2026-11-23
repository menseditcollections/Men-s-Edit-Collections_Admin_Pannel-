-- MEN'S EDIT COLLECTIONS — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor.

-- ============================================================
-- KEY: products — one row per clothing item
-- ============================================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category text not null check (category in ('Shirt','Pant','T-Shirt')),
  price numeric(10,2) not null check (price >= 0),
  purchase_price numeric(10,2),
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- KEY: sizes — stock lives HERE (per size), not on products.
-- product_id cascade = deleting a product deletes its sizes.
-- ============================================================
create table if not exists sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  label text not null,
  stock int not null default 0 check (stock >= 0),
  sold int not null default 0 check (sold >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sizes_product_idx on sizes(product_id);

-- ============================================================
-- KEY: daily_sales — manual revenue entries, UNIQUE per date.
-- Kept separate from item-sale revenue to avoid double counting.
-- ============================================================
create table if not exists daily_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null unique,
  amount numeric(10,2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- KEY: movements — the audit/history log. Every sale, retrieve,
-- stock change, product edit is recorded here. product_name /
-- size_label are denormalized so history survives deletes.
-- ============================================================
create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  product_name text,
  size_id uuid,
  size_label text,
  type text not null,
  quantity int not null default 0,
  amount numeric(10,2),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists movements_created_idx on movements(created_at desc);
create index if not exists movements_product_idx on movements(product_id);

-- ============================================================
-- KEY: day_closures — frozen end-of-day sales reports.
-- payload jsonb holds the full snapshot (items sold with
-- sizes & prices, retrieves, manual sales, totals).
-- One row per date (unique) — re-closing a day updates it.
-- ============================================================
create table if not exists day_closures (
  id uuid primary key default gen_random_uuid(),
  closure_date date not null unique,
  closed_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists day_closures_date_idx on day_closures(closure_date desc);

-- ============================================================
-- KEY: admins — one row per admin login.
-- password_hash = sha256("mec:" + password + ":" + AUTH_SECRET)
-- Seed the 3 admins with the INSERT statements below (hashes
-- are generated from your AUTH_SECRET — see project notes).
-- ============================================================
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ⚠ KEY SECURITY NOTE: RLS is enabled but every policy is
-- "public_all ... using (true)" = fully open read/write/delete
-- for anyone holding the anon key. The app's password middleware
-- is the ONLY protection. Harden before real production.
-- ============================================================
alter table products enable row level security;
alter table sizes enable row level security;
alter table daily_sales enable row level security;
alter table movements enable row level security;
alter table day_closures enable row level security;
alter table admins enable row level security;

create policy "public_all" on products for all using (true) with check (true);
create policy "public_all" on sizes for all using (true) with check (true);
create policy "public_all" on daily_sales for all using (true) with check (true);
create policy "public_all" on movements for all using (true) with check (true);
create policy "public_all" on day_closures for all using (true) with check (true);
create policy "public_all" on admins for all using (true) with check (true);

-- ============================================================
-- KEY: table-level GRANTs — without these, API roles get
-- "permission denied for table ..." even with correct keys.
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;

grant all on day_closures to anon, authenticated, service_role;
grant all on admins to anon, authenticated, service_role;

-- ============================================================
-- KEY: product-images storage bucket — public read + public
-- write/update/delete (same exposure warning as RLS above).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "public_read_product_images" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "public_write_product_images" on storage.objects
  for insert with check (bucket_id = 'product-images');
create policy "public_update_product_images" on storage.objects
  for update using (bucket_id = 'product-images');
create policy "public_delete_product_images" on storage.objects
  for delete using (bucket_id = 'product-images');
