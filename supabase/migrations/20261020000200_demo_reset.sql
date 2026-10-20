-- Resets the public demo to a known state: sample products, stock handed out
-- to the employees and two weeks of past sales. The hosted demo runs this
-- every night (see README), so visitors can add products and make sales
-- without anything piling up.
--
-- It deletes every product, sale and assignment, so it is only for a
-- database used as a demo. Accounts are matched by email and must already
-- exist in Supabase Auth.

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
