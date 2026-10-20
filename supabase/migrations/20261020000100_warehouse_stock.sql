-- Warehouse stock now moves when inventory is assigned. Raising an
-- employee's quantity takes the difference out of the warehouse; lowering it
-- puts the difference back. Rows are locked so two requests can't spend the
-- same stock at once.

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
  v_caller_role text;
  v_old_qty     int := 0;
  v_warehouse   int;
  v_delta       int;
begin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'owner' then
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

-- complete_sale: lock the employee's stock rows while checking them, so two
-- sales submitted together can't both pass the stock check.
create or replace function public.complete_sale(
  p_payment_method text,
  p_items          jsonb
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

  if p_payment_method not in ('Cash', 'E-transfer', 'Card', 'Other') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  -- The same product twice in one cart would pass the stock check twice.
  if (select count(distinct value->>'product_id') from jsonb_array_elements(p_items))
     <> jsonb_array_length(p_items) then
    raise exception 'DUPLICATE_ITEM';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'INVALID_QUANTITY:%', v_product_id;
    end if;

    select price into v_price
      from products
     where id = v_product_id and is_active = true;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_product_id;
    end if;

    select quantity into v_inv_qty
      from employee_inventory
     where employee_id = v_employee_id
       and product_id  = v_product_id
       for update;

    if not found or v_inv_qty < v_quantity then
      raise exception 'INSUFFICIENT_STOCK:%', v_product_id;
    end if;

    v_total := v_total + (v_price * v_quantity);
  end loop;

  insert into sales (employee_id, total_amount, payment_method)
  values (v_employee_id, v_total, p_payment_method)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity   := (v_item->>'quantity')::int;

    select price into v_price from products where id = v_product_id;

    insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (v_sale_id, v_product_id, v_quantity, v_price, v_price * v_quantity);

    update employee_inventory
       set quantity = quantity - v_quantity,
           updated_at = now()
     where employee_id = v_employee_id
       and product_id  = v_product_id;

    insert into inventory_logs (employee_id, product_id, action, quantity_change, note, sale_id)
    values (v_employee_id, v_product_id, 'SOLD', -v_quantity, 'Sale completed', v_sale_id);
  end loop;

  return v_sale_id;
end;
$$;

revoke execute on function public.assign_inventory(uuid, uuid, int, text) from public, anon;
grant execute on function public.assign_inventory(uuid, uuid, int, text) to authenticated;
revoke execute on function public.complete_sale(text, jsonb) from public, anon;
grant execute on function public.complete_sale(text, jsonb) to authenticated;
