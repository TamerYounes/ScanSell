import { beforeAll, describe, expect, it } from "vitest";
import { hasValidCheckDigit } from "../../src/lib/barcode";
import { asUser, createTestDb, createUser, errorOf, type TestDb } from "./db";

let db: TestDb;
let alex: string;

const reset = () =>
  db.query("select public.reset_demo_data($1, $2)", [
    "owner@demo.test",
    ["alex@demo.test", "jordan@demo.test"],
  ]);

async function one<T>(sql: string, params: unknown[] = []) {
  const { rows } = await db.query<T>(sql, params);
  return rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, "owner@demo.test");
  alex = await createUser(db, "alex@demo.test");
  await createUser(db, "jordan@demo.test");
  await reset();
});

describe("reset_demo_data", () => {
  it("sets up the owner, employees and products", async () => {
    const roles = await db.query<{ role: string; n: number }>(
      "select role, count(*)::int as n from public.profiles group by role order by role",
    );
    expect(roles.rows).toEqual([
      { role: "employee", n: 2 },
      { role: "owner", n: 1 },
    ]);

    const { rows: products } = await db.query<{ barcode: string }>(
      "select barcode from public.products",
    );
    expect(products).toHaveLength(12);
    expect(products.every((p) => hasValidCheckDigit(p.barcode))).toBe(true);
  });

  it("creates past sales whose totals match their items", async () => {
    const sales = await one<{ n: number; mismatched: number }>(`
      select count(*)::int as n,
             count(*) filter (
               where total_amount <> (select sum(subtotal) from public.sale_items i where i.sale_id = s.id)
             )::int as mismatched
        from public.sales s
    `);

    expect(sales.n).toBeGreaterThan(10);
    expect(sales.mismatched).toBe(0);
  });

  it("accounts for every unit: warehouse + held + sold = starting stock", async () => {
    const { rows } = await db.query<{ barcode: string; total: number }>(`
      select p.barcode,
             p.warehouse_stock
               + coalesce((select sum(quantity) from public.employee_inventory e where e.product_id = p.id), 0)
               + coalesce((select sum(quantity) from public.sale_items i where i.product_id = p.id), 0)
               as total
        from public.products p
       order by p.barcode
    `);

    // Starting warehouse stock from the migration, in barcode order.
    expect(rows.map((r) => Number(r.total))).toEqual([80, 50, 40, 45, 30, 25, 35, 20, 90, 18, 30, 60]);
  });

  it("never leaves negative stock", async () => {
    const negatives = await one<{ n: number }>(`
      select (select count(*) from public.employee_inventory where quantity < 0)
           + (select count(*) from public.products where warehouse_stock < 0) as n
    `);
    expect(Number(negatives.n)).toBe(0);
  });

  it("gives the same result when run again", async () => {
    const before = await one<{ sales: number; held: number }>(
      "select (select count(*) from public.sales)::int as sales, (select sum(quantity) from public.employee_inventory)::int as held",
    );

    await reset();

    const after = await one<{ sales: number; held: number }>(
      "select (select count(*) from public.sales)::int as sales, (select sum(quantity) from public.employee_inventory)::int as held",
    );
    expect(after).toEqual(before);
  });

  it("leaves a demo employee able to make a sale", async () => {
    const item = await one<{ product_id: string }>(
      "select product_id from public.employee_inventory where employee_id = $1 and quantity > 0 limit 1",
      [alex],
    );

    const error = await errorOf(
      asUser(db, alex, () =>
        db.query("select public.complete_sale('Cash', $1)", [
          JSON.stringify([{ product_id: item.product_id, quantity: 1 }]),
        ]),
      ),
    );
    expect(error).toBeNull();
  });

  it("clears invite links", async () => {
    const owner = await one<{ id: string }>(
      "select id from auth.users where email = 'owner@demo.test'",
    );
    await asUser(db, owner.id, () => db.query("select * from public.create_invite()"));

    await reset();

    const { rows } = await db.query("select 1 from public.invites");
    expect(rows).toHaveLength(0);
  });

  it("can't be called by signed-in users", async () => {
    const error = await errorOf(asUser(db, alex, () => reset()));
    expect(error).toMatch(/permission denied/);
  });

  it("refuses unknown demo accounts", async () => {
    const error = await errorOf(
      db.query("select public.reset_demo_data('nobody@demo.test', array['alex@demo.test'])"),
    );
    expect(error).toContain("DEMO_OWNER_NOT_FOUND");
  });
});
