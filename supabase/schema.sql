-- ============================================================
-- ScanSell — Supabase Schema
-- Paste this entire file into the Supabase SQL Editor and run.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Clean slate (safe to re-run during dev) ──────────────────
drop table if exists inventory_logs   cascade;
drop table if exists sale_items       cascade;
drop table if exists sales            cascade;
drop table if exists employee_inventory cascade;
drop table if exists products         cascade;
drop table if exists profiles         cascade;

-- ── profiles ─────────────────────────────────────────────────
-- One row per auth.users entry. Created by trigger on sign-up.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text        not null default '',
  role          text        not null default 'employee'
                            check (role in ('owner', 'employee')),
  avatar_color  text        not null default 'bg-slate-500',
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ── products ─────────────────────────────────────────────────
create table products (
  id              uuid primary key default uuid_generate_v4(),
  name            text    not null,
  barcode         text    not null unique,
  category        text    not null default 'General',
  price           numeric(10,2) not null check (price >= 0),
  warehouse_stock integer not null default 0 check (warehouse_stock >= 0),
  low_stock_limit integer not null default 5  check (low_stock_limit >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ── employee_inventory ───────────────────────────────────────
-- How much of each product is physically with each employee.
create table employee_inventory (
  id          uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references profiles(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  quantity    integer not null default 0 check (quantity >= 0),
  updated_at  timestamptz not null default now(),
  unique (employee_id, product_id)
);

-- ── sales ────────────────────────────────────────────────────
create table sales (
  id             uuid primary key default uuid_generate_v4(),
  employee_id    uuid not null references profiles(id) on delete restrict,
  total_amount   numeric(10,2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('Cash','E-transfer','Card','Other')),
  created_at     timestamptz not null default now()
);

-- ── sale_items ───────────────────────────────────────────────
create table sale_items (
  id         uuid primary key default uuid_generate_v4(),
  sale_id    uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity   integer      not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal   numeric(10,2) not null check (subtotal >= 0)
);

-- ── inventory_logs ───────────────────────────────────────────
create table inventory_logs (
  id              uuid primary key default uuid_generate_v4(),
  employee_id     uuid not null references profiles(id) on delete restrict,
  product_id      uuid not null references products(id) on delete restrict,
  action          text not null check (action in ('ASSIGNED','SOLD','RETURNED','ADJUSTED')),
  quantity_change integer not null,   -- negative = stock reduced
  note            text,
  sale_id         uuid references sales(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles          enable row level security;
alter table products          enable row level security;
alter table employee_inventory enable row level security;
alter table sales             enable row level security;
alter table sale_items        enable row level security;
alter table inventory_logs    enable row level security;

-- ── Helper: get caller's role without recursion ───────────────
-- We use a security-definer function so RLS policies can call it
-- cheaply without triggering infinite recursion on profiles.
create or replace function get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ── profiles policies ────────────────────────────────────────
-- Owner: full access. Employee: read own row only.
create policy "profiles: owner full access"
  on profiles for all
  using (get_my_role() = 'owner');

create policy "profiles: employee read own"
  on profiles for select
  using (auth.uid() = id);

-- ── products policies ────────────────────────────────────────
-- Owner: full access. Employee: read active products only.
create policy "products: owner full access"
  on products for all
  using (get_my_role() = 'owner');

create policy "products: employee read active"
  on products for select
  using (get_my_role() = 'employee' and is_active = true);

-- ── employee_inventory policies ──────────────────────────────
-- Owner: full access. Employee: read own rows only.
create policy "inventory: owner full access"
  on employee_inventory for all
  using (get_my_role() = 'owner');

create policy "inventory: employee read own"
  on employee_inventory for select
  using (get_my_role() = 'employee' and employee_id = auth.uid());

-- ── sales policies ───────────────────────────────────────────
-- Owner: full access. Employee: read/insert own only.
create policy "sales: owner full access"
  on sales for all
  using (get_my_role() = 'owner');

create policy "sales: employee read own"
  on sales for select
  using (get_my_role() = 'employee' and employee_id = auth.uid());

-- Insert is handled by the complete_sale RPC (security definer),
-- so employees do NOT need a direct insert policy on sales.

-- ── sale_items policies ──────────────────────────────────────
create policy "sale_items: owner full access"
  on sale_items for all
  using (get_my_role() = 'owner');

create policy "sale_items: employee read own"
  on sale_items for select
  using (
    get_my_role() = 'employee' and
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and s.employee_id = auth.uid()
    )
  );

-- ── inventory_logs policies ──────────────────────────────────
create policy "logs: owner full access"
  on inventory_logs for all
  using (get_my_role() = 'owner');

create policy "logs: employee read own"
  on inventory_logs for select
  using (get_my_role() = 'employee' and employee_id = auth.uid());

-- ============================================================
-- complete_sale RPC
-- Runs entirely server-side in a transaction:
--   1. verify caller is an active employee
--   2. fetch real prices from products table
--   3. verify employee has enough stock for every item
--   4. insert sale + sale_items
--   5. deduct employee_inventory
--   6. insert inventory_logs (action = SOLD)
-- Returns the new sale id on success; raises exception on failure.
-- ============================================================
create or replace function complete_sale(
  p_payment_method text,
  p_items          jsonb   -- [{product_id, quantity}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id   uuid;
  v_employee_role text;
  v_is_active     boolean;
  v_item          jsonb;
  v_product_id    uuid;
  v_quantity      int;
  v_price         numeric(10,2);
  v_inv_qty       int;
  v_total         numeric(10,2) := 0;
  v_sale_id       uuid;
begin
  -- ── 1. Verify caller ───────────────────────────────────────
  select id, role, is_active
    into v_employee_id, v_employee_role, v_is_active
    from profiles
   where id = auth.uid();

  if v_employee_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_employee_role <> 'employee' then
    raise exception 'NOT_AN_EMPLOYEE';
  end if;
  if not v_is_active then
    raise exception 'ACCOUNT_INACTIVE';
  end if;

  -- ── 2. Validate payment method ─────────────────────────────
  if p_payment_method not in ('Cash','E-transfer','Card','Other') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  -- ── 3. Validate items array ────────────────────────────────
  if jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  -- ── 4. Check prices + stock; accumulate total ──────────────
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    if v_quantity <= 0 then
      raise exception 'INVALID_QUANTITY:%', v_product_id;
    end if;

    -- Real price from DB (never trust frontend)
    select price into v_price
      from products
     where id = v_product_id and is_active = true;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_product_id;
    end if;

    -- Employee's assigned stock
    select quantity into v_inv_qty
      from employee_inventory
     where employee_id = v_employee_id
       and product_id  = v_product_id;

    if not found or v_inv_qty < v_quantity then
      raise exception 'INSUFFICIENT_STOCK:%', v_product_id;
    end if;

    v_total := v_total + (v_price * v_quantity);
  end loop;

  -- ── 5. Insert sale ─────────────────────────────────────────
  insert into sales (employee_id, total_amount, payment_method)
  values (v_employee_id, v_total, p_payment_method)
  returning id into v_sale_id;

  -- ── 6. Insert sale_items + deduct inventory + log ──────────
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    select price into v_price
      from products where id = v_product_id;

    insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (v_sale_id, v_product_id, v_quantity, v_price, v_price * v_quantity);

    update employee_inventory
       set quantity   = quantity - v_quantity,
           updated_at = now()
     where employee_id = v_employee_id
       and product_id  = v_product_id;

    insert into inventory_logs
      (employee_id, product_id, action, quantity_change, note, sale_id)
    values
      (v_employee_id, v_product_id, 'SOLD', -v_quantity,
       'Sale completed', v_sale_id);
  end loop;

  return v_sale_id;
end;
$$;

-- ============================================================
-- assign_inventory RPC  (owner-only)
-- Sets an employee's quantity for a product and logs it.
-- ============================================================
create or replace function assign_inventory(
  p_employee_id uuid,
  p_product_id  uuid,
  p_quantity    int,
  p_note        text default 'Owner assignment'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_old_qty     int := 0;
  v_delta       int;
begin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role <> 'owner' then
    raise exception 'OWNER_ONLY';
  end if;

  if p_quantity < 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select quantity into v_old_qty
    from employee_inventory
   where employee_id = p_employee_id and product_id = p_product_id;

  v_delta := p_quantity - coalesce(v_old_qty, 0);

  insert into employee_inventory (employee_id, product_id, quantity)
  values (p_employee_id, p_product_id, p_quantity)
  on conflict (employee_id, product_id)
  do update set quantity = p_quantity, updated_at = now();

  insert into inventory_logs
    (employee_id, product_id, action, quantity_change, note)
  values
    (p_employee_id, p_product_id, 'ASSIGNED', v_delta, p_note);
end;
$$;

-- ============================================================
-- Trigger: auto-create profile row when user signs up
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Seed data  (run once — comment out after first run)
-- ============================================================

-- NOTE: You must create users in Supabase Auth first
-- (Dashboard → Authentication → Users → "Add user").
-- After creating each user, copy their UUID and use it below.

-- Example seed — replace UUIDs with your real auth user IDs:
--
-- insert into profiles (id, full_name, role, avatar_color) values
--   ('AUTH_UUID_OWNER',   'Sarah Chen',      'owner',    'bg-indigo-500'),
--   ('AUTH_UUID_MARCUS',  'Marcus Williams', 'employee', 'bg-emerald-500'),
--   ('AUTH_UUID_PRIYA',   'Priya Patel',     'employee', 'bg-amber-500'),
--   ('AUTH_UUID_JORDAN',  'Jordan Lee',      'employee', 'bg-rose-500');
--
-- insert into products (name, barcode, category, price, warehouse_stock, low_stock_limit) values
--   ('Organic Whole Milk (1L)',        '012345678901', 'Dairy',     3.49,  100, 6),
--   ('Free-Range Eggs (12pk)',         '012345678902', 'Dairy',     5.99,   80, 5),
--   ('Sourdough Bread Loaf',           '012345678903', 'Bakery',    6.49,   60, 4),
--   ('Cold-Press Orange Juice (500ml)','012345678904', 'Beverages', 4.99,   50, 5),
--   ('Greek Yogurt Plain (500g)',      '012345678905', 'Dairy',     4.29,   90, 6),
--   ('Almond Butter (250g)',           '012345678906', 'Pantry',    8.99,   40, 3),
--   ('Sparkling Water 6-Pack',         '012345678907', 'Beverages', 5.49,   70, 4),
--   ('Granola Bar Mixed Box (12pk)',   '012345678908', 'Snacks',    9.99,   55, 5),
--   ('Cheddar Cheese Block (200g)',    '012345678909', 'Dairy',     5.79,   65, 4),
--   ('Maple Syrup Pure (250ml)',       '012345678910', 'Pantry',   12.99,   30, 3);
