import { beforeEach, describe, expect, it } from "vitest";
import {
  asAnon,
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
let mug: string;

function createInvite(as: string) {
  return asUser(db, as, async () => {
    const { rows } = await db.query<{ code: string; expires_at: string }>(
      "select * from public.create_invite()",
    );
    return rows[0];
  });
}

/** Signs up through the join page: auth metadata carries the invite code. */
function join(email: string, code: string | null, fullName = "New Hire") {
  return createUser(
    db,
    email,
    code === null ? { full_name: fullName } : { full_name: fullName, invite_code: code },
    { activate: false },
  );
}

async function profile(id: string) {
  const { rows } = await db.query<{ role: string; is_active: boolean; full_name: string }>(
    "select role, is_active, full_name from public.profiles where id = $1",
    [id],
  );
  return rows[0];
}

async function warehouse(productId: string) {
  const { rows } = await db.query<{ warehouse_stock: number }>(
    "select warehouse_stock from public.products where id = $1",
    [productId],
  );
  return rows[0].warehouse_stock;
}

function setActive(as: string, employeeId: string, active: boolean) {
  return asUser(db, as, () =>
    db.query("select public.set_employee_active($1, $2)", [employeeId, active]),
  );
}

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUser(db, "owner@example.com");
  await makeOwner(db, owner);
  alex = await createUser(db, "alex@example.com", { full_name: "Alex" });
  mug = await createProduct(db, { name: "Mug", barcode: "001", price: 10, warehouse: 20 });
});

describe("invites", () => {
  it("lets the owner create a single-use link that expires in a week", async () => {
    const invite = await createInvite(owner);

    expect(invite.code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    const days = (new Date(invite.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("signs up an active employee with a valid code", async () => {
    const { code } = await createInvite(owner);
    const id = await join("new@example.com", code.toLowerCase(), "  Sam Rivera ");

    expect(await profile(id)).toEqual({ role: "employee", is_active: true, full_name: "Sam Rivera" });

    const { rows } = await db.query<{ used_by: string }>(
      "select used_by from public.invites where code = $1",
      [code],
    );
    expect(rows[0].used_by).toBe(id);
  });

  it("refuses a code that was already used", async () => {
    const { code } = await createInvite(owner);
    await join("first@example.com", code);

    expect(await errorOf(join("second@example.com", code))).toContain("INVALID_INVITE");
    const { rows } = await db.query("select 1 from auth.users where email = 'second@example.com'");
    expect(rows).toHaveLength(0);
  });

  it("refuses expired and made-up codes", async () => {
    const { code } = await createInvite(owner);
    await db.query("update public.invites set expires_at = now() - interval '1 minute'");

    expect(await errorOf(join("late@example.com", code))).toContain("INVALID_INVITE");
    expect(await errorOf(join("guess@example.com", "AAAA-BBBB-CCCC"))).toContain("INVALID_INVITE");
  });

  it("leaves sign-ups without a code inactive, with no access", async () => {
    const id = await join("walk-in@example.com", null);
    expect(await profile(id)).toMatchObject({ role: "employee", is_active: false });

    await asUser(db, id, async () => {
      const { rows } = await db.query("select 1 from public.products");
      expect(rows).toHaveLength(0);

      expect(await errorOf(db.query("select * from public.create_invite()"))).toContain("OWNER_ONLY");
    });
  });

  it("only lets the owner create and see invites", async () => {
    await createInvite(owner);

    expect(await errorOf(createInvite(alex))).toContain("OWNER_ONLY");
    await asUser(db, alex, async () => {
      const { rows } = await db.query("select 1 from public.invites");
      expect(rows).toHaveLength(0);
    });
  });

  it("lets the owner revoke an unused invite", async () => {
    const { code } = await createInvite(owner);

    await asUser(db, owner, () => db.query("delete from public.invites where code = $1", [code]));

    expect(await errorOf(join("new@example.com", code))).toContain("INVALID_INVITE");
  });

  it("caps open invites at 20", async () => {
    for (let i = 0; i < 20; i++) await createInvite(owner);

    expect(await errorOf(createInvite(owner))).toContain("TOO_MANY_OPEN_INVITES");
  });

  it("tells visitors whether a code works, without exposing invites", async () => {
    const { code } = await createInvite(owner);

    await asAnon(db, async () => {
      const valid = await db.query<{ ok: boolean }>("select public.check_invite($1) as ok", [code]);
      const bogus = await db.query<{ ok: boolean }>("select public.check_invite('NOPE') as ok");
      expect(valid.rows[0].ok).toBe(true);
      expect(bogus.rows[0].ok).toBe(false);

      expect(await errorOf(db.query("select * from public.invites"))).toMatch(/permission denied/);
      expect(await errorOf(db.query("select * from public.create_invite()"))).toMatch(
        /permission denied/,
      );
    });
  });
});

describe("set_employee_active", () => {
  beforeEach(async () => {
    await asUser(db, owner, () => db.query("select public.assign_inventory($1, $2, 6)", [alex, mug]));
  });

  it("deactivating returns the employee's stock to the warehouse", async () => {
    expect(await warehouse(mug)).toBe(14);

    await setActive(owner, alex, false);

    expect(await warehouse(mug)).toBe(20);
    expect(await profile(alex)).toMatchObject({ is_active: false });

    const { rows } = await db.query<{ action: string; quantity_change: number }>(
      "select action, quantity_change from public.inventory_logs where note = 'Returned on deactivation'",
    );
    expect(rows).toEqual([{ action: "RETURNED", quantity_change: -6 }]);
  });

  it("cuts off a deactivated employee's access and sales", async () => {
    await setActive(owner, alex, false);

    await asUser(db, alex, async () => {
      const { rows } = await db.query("select 1 from public.sales");
      expect(rows).toHaveLength(0);
    });

    const error = await errorOf(
      asUser(db, alex, () =>
        db.query("select public.complete_sale('Cash', $1)", [
          JSON.stringify([{ product_id: mug, quantity: 1 }]),
        ]),
      ),
    );
    expect(error).toContain("ACCOUNT_INACTIVE");
  });

  it("reactivating restores access, and stock can be assigned again", async () => {
    await setActive(owner, alex, false);
    await setActive(owner, alex, true);

    await asUser(db, owner, () => db.query("select public.assign_inventory($1, $2, 2)", [alex, mug]));
    await asUser(db, alex, async () => {
      const { rows } = await db.query<{ quantity: number }>(
        "select quantity from public.employee_inventory",
      );
      expect(rows).toEqual([{ quantity: 2 }]);
    });
  });

  it("only works on employees, and only for the owner", async () => {
    expect(await errorOf(setActive(owner, owner, false))).toContain("EMPLOYEE_NOT_FOUND");
    expect(await errorOf(setActive(alex, alex, false))).toContain("OWNER_ONLY");
  });

  it("an inactive owner loses owner powers", async () => {
    await db.query("update public.profiles set is_active = false where id = $1", [owner]);

    expect(await errorOf(setActive(owner, alex, false))).toContain("OWNER_ONLY");
    expect(await errorOf(createInvite(owner))).toContain("OWNER_ONLY");
  });
});
