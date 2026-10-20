-- New accounts were given whatever role the sign-up request asked for
-- (raw_user_meta_data.role), so anyone could sign up as an owner. Every new
-- account is now an employee; the owner is promoted by hand in the database.

create or replace function public.handle_new_user()
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
    'employee'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
