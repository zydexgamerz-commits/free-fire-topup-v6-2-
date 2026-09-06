-- Free persistent storage for the Free Render deployment.
-- Run this once in Supabase SQL Editor.

create table if not exists public.app_products (
  id bigint primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_orders (
  id bigint primary key default 1,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id bigint primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_products enable row level security;
alter table public.app_orders enable row level security;
alter table public.app_settings enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  true,
  6291456,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update set public = true, file_size_limit = 6291456;

-- Seed the bundled products/settings so the store is populated on first deployment.
insert into public.app_products (id, data) values (1, '[{"id": "d100", "name": "100 Diamonds", "mode": "diamonds", "price": 80, "mrp": 90, "bonus": "+10 bonus", "stock": 0, "badge": "OUT OF STOCK", "image_url": "", "active": true}, {"id": "d310", "name": "310 Diamonds", "mode": "diamonds", "price": 240, "mrp": 260, "bonus": "+31 bonus", "stock": 144, "badge": "BEST VALUE", "image_url": "", "active": true}, {"id": "d520", "name": "520 Diamonds", "mode": "diamonds", "price": 400, "mrp": 440, "bonus": "+52 bonus", "stock": 65, "badge": "BEST VALUE", "image_url": "", "active": true}, {"id": "d1060", "name": "1060 Diamonds", "mode": "diamonds", "price": 800, "mrp": 860, "bonus": "+106 bonus", "stock": 398, "badge": "HOT", "image_url": "", "active": true}, {"id": "d2180", "name": "2180 Diamonds", "mode": "diamonds", "price": 1300, "mrp": 1700, "bonus": "+218 bonus", "stock": 345, "badge": "BEST VALUE", "image_url": "", "active": true}, {"id": "d5600", "name": "5600 Diamonds", "mode": "diamonds", "price": 2200, "mrp": 4300, "bonus": "+560 bonus", "stock": 131, "badge": "BEST VALUE", "image_url": "", "active": true}, {"id": "weekly", "name": "Weekly Pass", "mode": "passes", "price": 99, "mrp": 159, "bonus": "15-day rewards track", "stock": 225, "badge": "HOT", "image_url": "", "active": true}, {"id": "monthly", "name": "Monthly Pass", "mode": "passes", "price": 299, "mrp": 799, "bonus": "30-day rewards track", "stock": 285, "badge": "HOT", "image_url": "", "active": true}, {"id": "evo30", "name": "30 D Evo Pass", "mode": "passes", "price": 259, "mrp": 599, "bonus": "30 DAYS ACCESS", "stock": 124, "badge": "BEST VALUE", "image_url": "", "active": true}, {"id": "booyah", "name": "Booyah Pass", "mode": "passes", "price": 149, "mrp": 499, "bonus": "Current season — premium", "stock": 217, "badge": "HOT", "image_url": "", "active": true}, {"id": "booyahplus", "name": "Booyah+", "mode": "passes", "price": 299, "mrp": 999, "bonus": "Premium + 30 level jump", "stock": 133, "badge": "BEST VALUE", "image_url": "", "active": true}, {"id": "weeklylite", "name": "Weekly Lite", "mode": "passes", "price": 39, "mrp": 129, "bonus": "7-day rewards track", "stock": 156, "badge": "", "image_url": "", "active": true}]'::jsonb)
on conflict (id) do nothing;
insert into public.app_orders (id, data) values (1, '[]'::jsonb) on conflict (id) do nothing;
insert into public.app_settings (id, data) values (1, '{"storeName": "Free Fire Top Up", "subtitle": "Fast & Secure UID Verification", "qrUrl": "", "upiId": "", "supportText": "Support available after payment verification.", "updatedAt": null}'::jsonb) on conflict (id) do nothing;
