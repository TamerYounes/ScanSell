import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client.
 *
 * Uses NEXT_PUBLIC_* env vars only — no secrets here.
 * Import this in "use client" components that need to query Supabase
 * or call RPCs (e.g. complete_sale).
 *
 * Usage:
 *   const supabase = createClient();
 *   const { data } = await supabase.from("products").select("*");
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
