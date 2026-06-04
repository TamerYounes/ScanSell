import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/assign-inventory
 *
 * Owner-only endpoint to assign a quantity of a product to an employee.
 * Calls the assign_inventory Postgres RPC which:
 *   - verifies the caller is the owner
 *   - upserts the employee_inventory row
 *   - writes an inventory_log with action = ASSIGNED
 *
 * Request body:
 *   {
 *     employee_id: string,
 *     product_id:  string,
 *     quantity:    number,   // new absolute quantity (not a delta)
 *     note?:       string
 *   }
 *
 * Response:
 *   200  { success: true }
 *   400  { error: string }
 *   401  { error: string }
 *   403  { error: string }
 *   500  { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse body ─────────────────────────────────────────
    let body: {
      employee_id: string;
      product_id: string;
      quantity: number;
      note?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { employee_id, product_id, quantity, note } = body;

    // ── 2. Input validation ───────────────────────────────────
    if (!employee_id || typeof employee_id !== "string") {
      return NextResponse.json({ error: "employee_id is required." }, { status: 400 });
    }
    if (!product_id || typeof product_id !== "string") {
      return NextResponse.json({ error: "product_id is required." }, { status: 400 });
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) {
      return NextResponse.json(
        { error: "quantity must be a non-negative integer." },
        { status: 400 }
      );
    }

    // ── 3. Verify session ─────────────────────────────────────
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // ── 4. Verify caller is the owner ─────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Only the owner can assign inventory." },
        { status: 403 }
      );
    }

    // ── 5. Verify target is an active employee ────────────────
    const { data: target } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", employee_id)
      .single<{ role: string; is_active: boolean }>();

    if (!target) {
      return NextResponse.json({ error: "Employee not found." }, { status: 400 });
    }
    if (target.role !== "employee") {
      return NextResponse.json(
        { error: "Target user is not an employee." },
        { status: 400 }
      );
    }
    if (!target.is_active) {
      return NextResponse.json(
        { error: "Cannot assign inventory to an inactive employee." },
        { status: 400 }
      );
    }

    // ── 6. Verify product exists and is active ────────────────
    const { data: product } = await supabase
      .from("products")
      .select("id, is_active")
      .eq("id", product_id)
      .single<{ id: string; is_active: boolean }>();

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 400 });
    }
    if (!product.is_active) {
      return NextResponse.json(
        { error: "Cannot assign an inactive product." },
        { status: 400 }
      );
    }

    // ── 7. Call assign_inventory RPC ──────────────────────────
    // The RPC re-verifies ownership server-side, upserts the
    // employee_inventory row, and writes an inventory_log.
    const { error: rpcError } = await (supabase.rpc as any)(
      "assign_inventory",
      {
        p_employee_id: employee_id,
        p_product_id:  product_id,
        p_quantity:    quantity,
        p_note:        note ?? "Owner assignment",
      }
    );

    if (rpcError) {
      const msg = rpcError.message ?? "";
      if (msg.includes("OWNER_ONLY")) {
        return NextResponse.json(
          { error: "Only the owner can assign inventory." },
          { status: 403 }
        );
      }
      if (msg.includes("INVALID_QUANTITY")) {
        return NextResponse.json(
          { error: "Quantity must be zero or greater." },
          { status: 400 }
        );
      }
      console.error("[assign-inventory] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Assignment failed. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error("[assign-inventory] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
