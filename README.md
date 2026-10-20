# Stockpile

[![CI](https://github.com/TamerYounes/Stockpile/actions/workflows/ci.yml/badge.svg)](https://github.com/TamerYounes/Stockpile/actions/workflows/ci.yml)

Inventory and sales tracking for small resale businesses where the owner hands stock to sellers. The owner adds products, assigns stock from the warehouse to each employee and sees every sale. Employees see only what they're holding, scan or tap products into a cart and record the sale.

## What it does

**Owner**
- Add and edit products, scanning the barcode with the phone camera or typing it
- Assign stock to employees. Raising an employee's quantity takes it out of the warehouse; lowering it puts it back
- See stock by employee or by product, low-stock warnings, and all sales

**Employee**
- See the stock assigned to them
- Make a sale: scan with the camera, use a USB scanner, or search and tap
- See their own sales history

## How the important parts work

**Sales and stock changes happen in the database.** `complete_sale` and `assign_inventory` are Postgres functions. A sale looks up real prices (the browser never sends prices), checks the employee is holding enough of each item, then records the sale, deducts stock and writes the inventory log in one transaction. If any item fails, nothing is saved. Stock rows are locked while they're checked, so two requests can't spend the same units.

**Row-level security on every table.** Employees can only read their own stock and sales and can't write to stock tables directly. Every new account is an employee; the owner is set in the database.

**Barcodes.** UPC/EAN codes are checked against their check digit when a product is saved, which catches most typos. Shorter internal codes are allowed as-is. Scanning uses the camera through [ZXing](https://github.com/zxing-js/browser), loaded only on screens that need it.

## Stack

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- Supabase: email auth, Postgres, row-level security, SQL functions
- Vitest, with database tests on [PGlite](https://pglite.dev) (Postgres compiled to WebAssembly)
- GitHub Actions, Vercel

## Running it locally

You need Node 22 and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

Set up the database by running the files in `supabase/migrations` in order (or `supabase db push` with the Supabase CLI). Create your account in Supabase Auth, then make it the owner:

```sql
update profiles set role = 'owner' where id = '<your user id>';
```

## Tests

```bash
npm test          # unit and database tests
npm run typecheck
npm run lint
```

The database tests apply every migration to a fresh in-memory Postgres with a small stand-in for Supabase's `auth` schema. They cover sales (prices, stock checks, rollback when one item fails, duplicate items), stock moving between the warehouse and employees, sign-up roles, and what each role can see and change under RLS. CI runs all of these plus a production build on every push.

## Demo

The live demo signs in to a shared owner or employee account. Its data is reset every night by `reset_demo_data`, which deletes all products, sales and assignments and loads a sample shop, so it must only run against a database used for the demo. It's scheduled with `pg_cron`:

```sql
select cron.schedule('reset-demo', '0 9 * * *', $$
  select public.reset_demo_data('owner@example.com', array['employee1@example.com', 'employee2@example.com'])
$$);
```
