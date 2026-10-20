import { beforeEach, describe, expect, it } from "vitest";
import {
  asUser,
  createProduct,
  createTestDb,
  createUser,
  errorOf,
  makeOwner,
  type TestDb,
} from "./db";

let db: TestDb;
let owner: string;
let alex: string;
let sam: string;
let mug: string;
let tote: string;

async function stock(employeeId: string, productId: string) {
  const { rows } = await db.query<{ quantity: number }>(
    "select quantity from public.employee_inventory where employee_id = $1 and product_id = $2",
    [employeeId, productId],
  );
  return rows[0]?.quantity ?? 0;
}

async function warehouse(productId: string) {
  const { rows } = await db.query<{ warehouse_stock: number }>(
    "select warehouse_stock from public.products where id = $1",
    [productId],
  );
  return rows[0].warehouse_stock;
}

function assign(as: string, employeeId: string, productId: string, quantity: number) {
  return asUser(db, as, () =>
    db.query("select public.assign_inventory($1, $2, $3)", [employeeId, productId, quantity]),
  );
}

function sell(as: string, items: { product_id: string; quantity: number }[], method = "Cash") {
  return asUser(db, as, () =>
    db.query<{ complete_sale: string }>("select public.complete_sale($1, $2)", [
      method,
      JSON.stringify(items),
    ]),
  );
}

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUser(db, "owner@example.com");
  await makeOwner(db, owner);
  alex = await createUser(db, "alex@example.com", { full_name: "Alex" });
  sam = await createUser(db, "sam@example.com", { full_name: "Sam" });
  mug = await createProduct(db, { name: "Mug", barcode: "001", price: 12.5, warehouse: 20 });
  tote = await createProduct(db, { name: "Tote", barcode: "002", price: 8, warehouse: 5 });
});

describe("sign-up", () => {
  it("makes every new account an employee, whatever the request asks for", async () => {
    const id = await createUser(db, "sneaky@example.com", { role: "owner", full_name: "Sneaky" });

    const { rows } = await db.query<{ role: string; full_name: string }>(
      "select role, full_name from public.profiles where id = $1",
      [id],
    );

    expect(rows[0]).toEqual({ role: "employee", full_name: "Sneaky" });
  });
});

describe("assign_inventory", () => {
  it("moves stock from the warehouse to the employee", async () => {
    await assign(owner, alex, mug, 6);

    expect(await stock(alex, mug)).toBe(6);
    expect(await warehouse(mug)).toBe(14);
  });

  it("returns stock to the warehouse when the quantity is lowered", async () => {
    await assign(owner, alex, mug, 6);
    await assign(owner, alex, mug, 2);

    expect(await stock(alex, mug)).toBe(2);
    expect(await warehouse(mug)).toBe(18);

    const { rows } = await db.query<{ action: string; quantity_change: number }>(
      "select action, quantity_change from public.inventory_logs order by created_at, quantity_change desc",
    );
    expect(rows).toEqual([
      { action: "ASSIGNED", quantity_change: 6 },
      { action: "RETURNED", quantity_change: -4 },
    ]);
  });

  it("refuses to assign more than the warehouse holds", async () => {
    expect(await errorOf(assign(owner, alex, tote, 6))).toContain(
      "INSUFFICIENT_WAREHOUSE_STOCK",
    );
    expect(await warehouse(tote)).toBe(5);
    expect(await stock(alex, tote)).toBe(0);
  });

  it("only lets the owner assign", async () => {
    expect(await errorOf(assign(alex, alex, mug, 3))).toContain("OWNER_ONLY");
  });

  it("only assigns to active employees", async () => {
    await db.query("update public.profiles set is_active = false where id = $1", [sam]);

    expect(await errorOf(assign(owner, sam, mug, 1))).toContain("EMPLOYEE_NOT_FOUND");
    expect(await errorOf(assign(owner, owner, mug, 1))).toContain("EMPLOYEE_NOT_FOUND");
  });
});

describe("complete_sale", () => {
  beforeEach(async () => {
    await assign(owner, alex, mug, 5);
    await assign(owner, alex, tote, 2);
  });

  it("records the sale at database prices and deducts the employee's stock", async () => {
    const result = await sell(alex, [
      { product_id: mug, quantity: 2 },
      { product_id: tote, quantity: 1 },
    ]);
    const saleId = result.rows[0].complete_sale;

    const { rows: sales } = await db.query<{ total_amount: string; employee_id: string }>(
      "select total_amount, employee_id from public.sales where id = $1",
      [saleId],
    );
    expect(sales[0]).toEqual({ total_amount: "33.00", employee_id: alex });
    expect(await stock(alex, mug)).toBe(3);
    expect(await stock(alex, tote)).toBe(1);
  });

  it("won't sell more than the employee is holding", async () => {
    expect(await errorOf(sell(alex, [{ product_id: mug, quantity: 6 }]))).toContain(
      "INSUFFICIENT_STOCK",
    );
    expect(await stock(alex, mug)).toBe(5);
  });

  it("rolls back the whole sale if any item fails", async () => {
    const error = await errorOf(
      sell(alex, [
        { product_id: mug, quantity: 1 },
        { product_id: tote, quantity: 9 },
      ]),
    );

    expect(error).toContain("INSUFFICIENT_STOCK");
    expect(await stock(alex, mug)).toBe(5);
    const { rows } = await db.query("select 1 from public.sales");
    expect(rows).toHaveLength(0);
  });

  it("rejects the same product listed twice", async () => {
    const error = await errorOf(
      sell(alex, [
        { product_id: mug, quantity: 3 },
        { product_id: mug, quantity: 3 },
      ]),
    );

    expect(error).toContain("DUPLICATE_ITEM");
    expect(await stock(alex, mug)).toBe(5);
  });

  it("can't sell stock assigned to someone else", async () => {
    expect(await errorOf(sell(sam, [{ product_id: mug, quantity: 1 }]))).toContain(
      "INSUFFICIENT_STOCK",
    );
  });

  it("rejects empty carts, bad quantities and unknown payment methods", async () => {
    expect(await errorOf(sell(alex, []))).toContain("EMPTY_CART");
    expect(await errorOf(sell(alex, [{ product_id: mug, quantity: 0 }]))).toContain(
      "INVALID_QUANTITY",
    );
    expect(await errorOf(sell(alex, [{ product_id: mug, quantity: 1 }], "Crypto"))).toContain(
      "INVALID_PAYMENT_METHOD",
    );
  });

  it("only lets active employees sell", async () => {
    expect(await errorOf(sell(owner, [{ product_id: mug, quantity: 1 }]))).toContain(
      "NOT_AN_EMPLOYEE",
    );

    await db.query("update public.profiles set is_active = false where id = $1", [alex]);
    expect(await errorOf(sell(alex, [{ product_id: mug, quantity: 1 }]))).toContain(
      "ACCOUNT_INACTIVE",
    );
  });
});

describe("row-level security", () => {
  beforeEach(async () => {
    await assign(owner, alex, mug, 3);
    await assign(owner, sam, tote, 2);
    await sell(alex, [{ product_id: mug, quantity: 1 }]);
    await sell(sam, [{ product_id: tote, quantity: 1 }]);
  });

  it("employees only see their own stock and sales", async () => {
    await asUser(db, alex, async () => {
      const inventory = await db.query<{ employee_id: string }>(
        "select employee_id from public.employee_inventory",
      );
      const sales = await db.query<{ employee_id: string }>(
        "select employee_id from public.sales",
      );

      expect(inventory.rows.every((r) => r.employee_id === alex)).toBe(true);
      expect(sales.rows).toEqual([{ employee_id: alex }]);
    });
  });

  it("employees can't change their own role or stock directly", async () => {
    await asUser(db, alex, async () => {
      await db.query("update public.profiles set role = 'owner' where id = $1", [alex]);
      await db.query(
        "update public.employee_inventory set quantity = 999 where employee_id = $1",
        [alex],
      );
    });

    const { rows } = await db.query<{ role: string }>(
      "select role from public.profiles where id = $1",
      [alex],
    );
    expect(rows[0].role).toBe("employee");
    expect(await stock(alex, mug)).toBe(2);
  });

  it("the owner sees everything", async () => {
    await asUser(db, owner, async () => {
      const { rows } = await db.query("select 1 from public.sales");
      expect(rows).toHaveLength(2);
    });
  });
});
