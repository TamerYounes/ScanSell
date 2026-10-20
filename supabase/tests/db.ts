import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const migrationsDir = join(__dirname, "..", "migrations");

/**
 * A fresh in-memory Postgres with every migration applied, plus a minimal
 * stand-in for Supabase's auth schema (auth.users and auth.uid()).
 */
export async function createTestDb() {
  const db = new PGlite({ extensions: { uuid_ossp } });

  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }

  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
  `);

  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Creates an auth user (which the trigger turns into a profile). */
export async function createUser(
  db: TestDb,
  email: string,
  metadata: Record<string, unknown> = {},
) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(metadata)],
  );
  return rows[0].id;
}

export async function makeOwner(db: TestDb, userId: string) {
  await db.query("update public.profiles set role = 'owner' where id = $1", [userId]);
}

export async function createProduct(
  db: TestDb,
  values: { name: string; barcode: string; price: number; warehouse: number },
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.products (name, barcode, price, warehouse_stock)
     values ($1, $2, $3, $4) returning id`,
    [values.name, values.barcode, values.price, values.warehouse],
  );
  return rows[0].id;
}

/** Runs `fn` as a signed-in user, with row-level security applied. */
export async function asUser<T>(db: TestDb, userId: string, fn: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");

  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Returns the database error message, or null if the query succeeded. */
export async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
