-- Owners add employees with single-use invite links, and can deactivate and
-- reactivate them.
--
-- Sign-up goes through handle_new_user:
--   * with a valid invite code: an active employee, and the invite is used up
--   * with an invalid or used code: the sign-up fails
--   * with no code: an inactive employee the owner has to turn on. This
--     covers accounts added in the Supabase dashboard and anyone signing up
--     against the API directly.
--
-- Inactive accounts get no access: get_my_role() returns null for them, and
-- every policy goes through it.

-- invites ---------------------------------------------------------------------

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_by     uuid references public.profiles (id) on delete set null,
  used_at     timestamptz
);

alter table public.invites enable row level security;

-- Owners can see and revoke invites. Creating one goes through create_invite.
create policy "invites: owner read"
  on public.invites for select to authenticated
  using (public.get_my_role() = 'owner');

create policy "invites: owner delete"
  on public.invites for delete to authenticated
  using (public.get_my_role() = 'owner' and used_by is null);

-- Inactive accounts have no role -----------------------------------------------

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

-- create_invite ----------------------------------------------------------------

create or replace function public.create_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if get_my_role() is distinct from 'owner' then
    raise exception 'OWNER_ONLY';
  end if;

  -- Keeps the table from filling up, mostly for the public demo.
  if (select count(*) from invites i
       where i.used_by is null and i.expires_at > now()) >= 20 then
    raise exception 'TOO_MANY_OPEN_INVITES';
  end if;

  -- 12 random hex characters, shown as XXXX-XXXX-XXXX.
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4);

  return query
    insert into invites (code, created_by, expires_at)
    values (v_code, auth.uid(), now() + interval '7 days')
    returning invites.code, invites.expires_at;
end;
$$;

revoke execute on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;

-- check_invite: lets the join page say whether a link still works --------------

create or replace function public.check_invite(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from invites
     where code = upper(trim(p_code))
       and used_by is null
       and expires_at > now()
  );
$$;

revoke execute on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;

-- Sign-up ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text := nullif(upper(trim(new.raw_user_meta_data->>'invite_code')), '');
  v_invite uuid;
begin
  -- The profile has to exist before the invite can point at it.
  insert into profiles (id, full_name, role, is_active)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), 80),
    'employee',
    false
  )
  on conflict (id) do nothing;

  if v_code is not null then
    update invites
       set used_by = new.id, used_at = now()
     where code = v_code
       and used_by is null
       and expires_at > now()
    returning id into v_invite;

    -- Fails the whole sign-up, so no account is created.
    if v_invite is null then
      raise exception 'INVALID_INVITE';
    end if;

    update profiles set is_active = true where id = new.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- set_employee_active ----------------------------------------------------------

-- Deactivating returns everything the employee is holding to the warehouse,
-- so no stock is stuck with someone who can't sell it.
create or replace function public.set_employee_active(
  p_employee_id uuid,
  p_active      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if get_my_role() is distinct from 'owner' then
    raise exception 'OWNER_ONLY';
  end if;

  perform 1 from profiles
   where id = p_employee_id and role = 'employee'
     for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  update profiles set is_active = p_active where id = p_employee_id;

  if not p_active then
    for v_row in
      delete from employee_inventory
       where employee_id = p_employee_id and quantity > 0
      returning product_id, quantity
    loop
      update products
         set warehouse_stock = warehouse_stock + v_row.quantity
       where id = v_row.product_id;

      insert into inventory_logs (employee_id, product_id, action, quantity_change, note)
      values (p_employee_id, v_row.product_id, 'RETURNED', -v_row.quantity, 'Returned on deactivation');
    end loop;

    delete from employee_inventory where employee_id = p_employee_id;
  end if;
end;
$$;

revoke execute on function public.set_employee_active(uuid, boolean) from public, anon;
grant execute on function public.set_employee_active(uuid, boolean) to authenticated;

-- assign_inventory: go through get_my_role so an inactive owner can't assign --

create or replace function public.assign_inventory(
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
  v_old_qty   int := 0;
  v_warehouse int;
  v_delta     int;
begin
  if get_my_role() is distinct from 'owner' then
    raise exception 'OWNER_ONLY';
  end if;

  if p_quantity < 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if not exists (
    select 1 from profiles
    where id = p_employee_id and role = 'employee' and is_active
  ) then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  select warehouse_stock into v_warehouse
    from products
   where id = p_product_id and is_active
     for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select quantity into v_old_qty
    from employee_inventory
   where employee_id = p_employee_id and product_id = p_product_id
     for update;

  v_delta := p_quantity - coalesce(v_old_qty, 0);

  if v_delta = 0 then
    return;
  end if;

  if v_delta > v_warehouse then
    raise exception 'INSUFFICIENT_WAREHOUSE_STOCK';
  end if;

  update products
     set warehouse_stock = warehouse_stock - v_delta
   where id = p_product_id;

  insert into employee_inventory (employee_id, product_id, quantity)
  values (p_employee_id, p_product_id, p_quantity)
  on conflict (employee_id, product_id)
  do update set quantity = p_quantity, updated_at = now();

  insert into inventory_logs (employee_id, product_id, action, quantity_change, note)
  values (
    p_employee_id,
    p_product_id,
    case when v_delta > 0 then 'ASSIGNED' else 'RETURNED' end,
    v_delta,
    p_note
  );
end;
$$;

-- reset_demo_data: same as before, plus clearing invites --------------------

create or replace function public.reset_demo_data(
  p_owner_email     text,
  p_employee_emails text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner     uuid;
  v_employees uuid[];
  v_employee  uuid;
  v_names     text[] := array['Alex Rivera', 'Jordan Lee', 'Priya Patel', 'Marcus Chen'];
  v_colors    text[] := array['bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'];
  v_sale      uuid;
  v_product   record;
  v_day       int;
  v_qty       int;
  i           int;
begin
  select id into v_owner from auth.users where lower(email) = lower(p_owner_email);
  if v_owner is null then
    raise exception 'DEMO_OWNER_NOT_FOUND: %', p_owner_email;
  end if;

  select array_agg(u.id order by e.ord)
    into v_employees
    from unnest(p_employee_emails) with ordinality as e(email, ord)
    join auth.users u on lower(u.email) = lower(e.email);

  if coalesce(array_length(v_employees, 1), 0) <> array_length(p_employee_emails, 1) then
    raise exception 'DEMO_EMPLOYEE_NOT_FOUND';
  end if;

  delete from invites;
  delete from inventory_logs;
  delete from sale_items;
  delete from sales;
  delete from employee_inventory;
  delete from products;

  update profiles
     set role = 'owner', full_name = 'Sam Morgan', avatar_color = 'bg-indigo-500', is_active = true
   where id = v_owner;

  for i in 1 .. array_length(v_employees, 1) loop
    update profiles
       set role = 'employee',
           full_name = v_names[1 + (i - 1) % array_length(v_names, 1)],
           avatar_color = v_colors[1 + (i - 1) % array_length(v_colors, 1)],
           is_active = true
     where id = v_employees[i];
  end loop;

  -- A small phone accessories reseller. Barcodes are valid UPC-A codes.
  insert into products (name, barcode, category, price, warehouse_stock, low_stock_limit) values
    ('USB-C Charging Cable (1m)',      '062861000018', 'Cables',     12.99, 80, 10),
    ('USB-C Charging Cable (2m)',      '062861000025', 'Cables',     16.99, 50, 8),
    ('Lightning Cable (1m)',           '062861000032', 'Cables',     14.99, 40, 8),
    ('20W USB-C Wall Charger',         '062861000049', 'Chargers',   24.99, 45, 6),
    ('Dual-Port Car Charger',          '062861000056', 'Chargers',   19.99, 30, 5),
    ('10,000 mAh Power Bank',          '062861000063', 'Chargers',   39.99, 25, 4),
    ('Clear Case (iPhone 15)',         '062861000070', 'Cases',      19.99, 35, 5),
    ('Rugged Case (Galaxy S24)',       '062861000087', 'Cases',      29.99, 20, 4),
    ('Tempered Glass Screen Protector','062861000094', 'Protection',  9.99, 90, 12),
    ('Wireless Earbuds',               '062861000100', 'Audio',      49.99, 18, 3),
    ('Wired Earbuds (USB-C)',          '062861000117', 'Audio',      14.99, 30, 5),
    ('Phone Grip Stand',               '062861000124', 'Accessories', 7.99, 60, 10);

  -- Hand out stock: each employee gets a slightly different mix.
  for i in 1 .. array_length(v_employees, 1) loop
    v_employee := v_employees[i];

    for v_product in
      select id, barcode, warehouse_stock from products order by barcode
    loop
      v_qty := least(
        v_product.warehouse_stock,
        4 + get_byte(decode(md5(v_product.barcode || i::text), 'hex'), 0) % 6
      );

      if get_byte(decode(md5(v_product.barcode || i::text), 'hex'), 1) % 5 = 0 then
        continue; -- not everyone carries everything
      end if;

      update products set warehouse_stock = warehouse_stock - v_qty where id = v_product.id;
      insert into employee_inventory (employee_id, product_id, quantity)
      values (v_employee, v_product.id, v_qty);
      insert into inventory_logs (employee_id, product_id, action, quantity_change, note, created_at)
      values (v_employee, v_product.id, 'ASSIGNED', v_qty, 'Demo starting stock', now() - interval '15 days');
    end loop;
  end loop;

  -- Two weeks of sales, a few per employee per day, at most 1-2 units each.
  for i in 1 .. array_length(v_employees, 1) loop
    v_employee := v_employees[i];

    for v_day in reverse 14 .. 1 loop
      if (v_day + i) % 3 = 0 then
        continue; -- days off
      end if;

      insert into sales (employee_id, total_amount, payment_method, created_at)
      values (
        v_employee,
        0,
        (array['Cash', 'E-transfer', 'Card', 'Card'])[1 + (v_day + i) % 4],
        date_trunc('day', now()) - make_interval(days => v_day) + make_interval(hours => 10 + (v_day * i) % 8)
      )
      returning id into v_sale;

      for v_product in
        select ei.product_id, ei.quantity, p.price
          from employee_inventory ei
          join products p on p.id = ei.product_id
         where ei.employee_id = v_employee and ei.quantity > 2
         order by md5(p.barcode || v_day::text)
         limit 1 + (v_day + i) % 2
      loop
        v_qty := 1 + (v_day % 2);

        insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
        values (v_sale, v_product.product_id, v_qty, v_product.price, v_product.price * v_qty);

        update employee_inventory
           set quantity = quantity - v_qty
         where employee_id = v_employee and product_id = v_product.product_id;

        insert into inventory_logs (employee_id, product_id, action, quantity_change, note, sale_id, created_at)
        values (v_employee, v_product.product_id, 'SOLD', -v_qty, 'Sale completed', v_sale,
                (select created_at from sales where id = v_sale));
      end loop;

      update sales
         set total_amount = coalesce((select sum(subtotal) from sale_items where sale_id = v_sale), 0)
       where id = v_sale;

      delete from sales where id = v_sale and total_amount = 0;
    end loop;
  end loop;
end;
$$;

-- Only the database itself (the nightly job) can run this.
revoke execute on function public.reset_demo_data(text, text[]) from public, anon, authenticated;
