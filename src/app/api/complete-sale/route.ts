import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/complete-sale
 *
 * Server-side sale completion endpoint.
 *
 * Why this exists alongside the RPC:
 *  - Gives us a clean HTTP layer for error handling and logging
 *  - Lets us verify the session server-side before the RPC even runs
 *  - Keeps the service-role key off the client entirely
 *  - Makes it easy to add rate-limiting or audit logging later
 *
 * The actual business logic (price lookup, stock check, inserts,
 * inventory deduction, log writes) all happen inside the
 * complete_sale Postgres function — not here.
 *
 * Request body:
 *   {
 *     payment_method: "Cash" | "E-transfer" | "Card" | "Other",
 *     items: [{ product_id: string, quantity: number }, ...]
 *   }
 *
 * Response:
 *   200  { sale_id: string }
 *   400  { error: string }   — validation or business rule failure
 *   401  { error: string }   — not authenticated
 *   403  { error: string }   — not an active employee
 *   500  { error: string }   — unexpected server error
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse body ───────────────────────────────────────────
    let body: { payment_method: string; items: { product_id: string; quantity: number }[] };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { payment_method, items } = body;

    // ── 2. Basic input validation ───────────────────────────────
    const validMethods = ["Cash", "E-transfer", "Card", "Other"];
    if (!payment_method || !validMethods.includes(payment_method)) {
      return NextResponse.json(
        { error: "Invalid payment method. Must be Cash, E-transfer, Card, or Other." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    for (const item of items) {
      if (!item.product_id || typeof item.product_id !== "string") {
        return NextResponse.json({ error: "Each item must have a product_id." }, { status: 400 });
      }
      if (!item.quantity || typeof item.quantity !== "number" || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        return NextResponse.json(
          { error: "Each item must have a positive integer quantity." },
          { status: 400 }
        );
      }
    }

    // ── 3. Verify session server-side ───────────────────────────
    // Uses the anon key + session cookie — no service role needed here.
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // ── 4. Verify caller is an active employee ──────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single<{ role: string; is_active: boolean }>();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 403 });
    }

    if (profile.role !== "employee") {
      return NextResponse.json(
        { error: "Only employees can complete sales." },
        { status: 403 }
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: "Your account is inactive. Contact your manager." },
        { status: 403 }
      );
    }

    // ── 5. Call the complete_sale RPC ───────────────────────────
    // The RPC runs as security definer inside Postgres and:
    //   - re-verifies auth.uid() is an active employee
    //   - fetches real prices from the products table
    //   - checks employee_inventory stock for each item
    //   - inserts the sale + sale_items rows
    //   - deducts from employee_inventory
    //   - writes inventory_logs with action = SOLD
    // All of the above happens in a single transaction.
    const { data: saleId, error: rpcError } = await supabase.rpc(
      "complete_sale",
      {
        p_payment_method: payment_method,
        p_items:          items,
      }
    );

    if (rpcError) {
      // Map Postgres exception messages to user-friendly responses
      const msg = rpcError.message ?? "";

      if (msg.includes("INSUFFICIENT_STOCK")) {
        return NextResponse.json(
          { error: "Not enough stock for one or more items in your cart." },
          { status: 400 }
        );
      }
      if (msg.includes("PRODUCT_NOT_FOUND")) {
        return NextResponse.json(
          { error: "One or more products in your cart no longer exist." },
          { status: 400 }
        );
      }
      if (msg.includes("DUPLICATE_ITEM")) {
        return NextResponse.json(
          { error: "A product is listed twice in the cart." },
          { status: 400 }
        );
      }
      if (msg.includes("EMPTY_CART")) {
        return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
      }
      if (msg.includes("NOT_AN_EMPLOYEE")) {
        return NextResponse.json(
          { error: "Only employees can complete sales." },
          { status: 403 }
        );
      }
      if (msg.includes("ACCOUNT_INACTIVE")) {
        return NextResponse.json(
          { error: "Your account is inactive." },
          { status: 403 }
        );
      }
      if (msg.includes("INVALID_PAYMENT_METHOD")) {
        return NextResponse.json(
          { error: "Invalid payment method." },
          { status: 400 }
        );
      }

      console.error("[complete-sale] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Sale could not be completed. Please try again." },
        { status: 500 }
      );
    }

    // ── 6. Return the new sale ID ───────────────────────────────
    return NextResponse.json({ sale_id: saleId }, { status: 200 });

  } catch (err) {
    console.error("[complete-sale] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
