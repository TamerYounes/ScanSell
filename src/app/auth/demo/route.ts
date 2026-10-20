import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const accounts = {
  owner: { email: process.env.DEMO_OWNER_EMAIL, password: process.env.DEMO_OWNER_PASSWORD },
  employee: { email: process.env.DEMO_EMPLOYEE_EMAIL, password: process.env.DEMO_EMPLOYEE_PASSWORD },
};

/**
 * Signs in to one of the demo accounts. Passwords stay on the server, so
 * they never reach the browser. The demo data resets every night.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const role = form.get("role");
  const account = role === "owner" || role === "employee" ? accounts[role] : null;

  if (!account?.email || !account.password) {
    return NextResponse.redirect(new URL("/?demo=unavailable", request.url), 303);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error) {
    console.error("Demo sign-in failed:", error.message);
    return NextResponse.redirect(new URL("/?demo=unavailable", request.url), 303);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
