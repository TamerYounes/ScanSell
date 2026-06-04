"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import type { CartItem, ProductWithStock, PaymentMethod } from "@/types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "E-transfer", "Card", "Other"];
const paymentIcons: Record<PaymentMethod, string> = {
  Cash: "💵", "E-transfer": "📲", Card: "💳", Other: "🔄",
};

export default function EmployeeNewSale() {
  const router   = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // Employee's assigned inventory — fetched once on mount
  const [myInventory, setMyInventory] = useState<ProductWithStock[]>([]);

  // Cart lives in local state; only product IDs + quantities go to the server
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput]   = useState("");
  const [scanMessage, setScanMessage]     = useState<{ text: string; success: boolean } | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("Cash");
  const [completing, setCompleting]       = useState(false);
  const [saleSuccess, setSaleSuccess]     = useState(false);

  // Load employee inventory on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("employee_inventory")
        .select("quantity, products(*)")
        .eq("employee_id", user.id);

      const inv: ProductWithStock[] = (data ?? []).map((row: any) => ({
        ...row.products,
        stockQuantity: row.quantity,
      }));
      setMyInventory(inv);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus barcode input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Auto-clear scan message after 3 s
  useEffect(() => {
    if (!scanMessage) return;
    const t = setTimeout(() => setScanMessage(null), 3000);
    return () => clearTimeout(t);
  }, [scanMessage]);

  // ── Cart helpers ────────────────────────────────────────────
  const cartTotal     = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  function addToCart(barcode: string): { success: boolean; message: string } {
    const product = myInventory.find((p) => p.barcode === barcode.trim());
    if (!product) {
      return { success: false, message: `No product found for barcode "${barcode}"` };
    }

    const cartItem    = cart.find((i) => i.product.id === product.id);
    const currentQty  = cartItem?.quantity ?? 0;

    // Use the inventory snapshot loaded at mount.
    // The server re-checks stock before committing.
    if (currentQty >= product.stockQuantity) {
      return {
        success: false,
        message: `Only ${product.stockQuantity} unit${product.stockQuantity !== 1 ? "s" : ""} of "${product.name}" in your stock`,
      };
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    return { success: true, message: `"${product.name}" added to cart` };
  }

  function updateQty(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    const invProduct = myInventory.find((p) => p.id === productId);
    const max = invProduct?.stockQuantity ?? 0;
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: Math.min(quantity, max) } : i
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  // ── Barcode submit ──────────────────────────────────────────
  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;
    const result = addToCart(barcode);
    setScanMessage({ text: result.message, success: result.success });
    setBarcodeInput("");
    inputRef.current?.focus();
  }

  // ── Complete sale ───────────────────────────────────────────
  // Calls POST /api/complete-sale which:
  //   1. verifies session server-side
  //   2. confirms caller is an active employee
  //   3. forwards to the complete_sale Postgres RPC which:
  //      - fetches real prices from the DB (never trusts frontend)
  //      - checks employee stock
  //      - inserts sale + sale_items in one transaction
  //      - deducts employee_inventory
  //      - writes inventory_logs (action = SOLD)
  async function handleCompleteSale() {
    if (cart.length === 0) return;
    setCompleting(true);

    const items = cart.map((i) => ({
      product_id: i.product.id,
      quantity:   i.quantity,
    }));

    const res = await fetch("/api/complete-sale", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ payment_method: selectedPayment, items }),
    });

    const json = await res.json();

    if (!res.ok) {
      setScanMessage({ text: json.error ?? "Sale failed. Please try again.", success: false });
      setCompleting(false);
      return;
    }

    // Success — update local inventory snapshot so the UI stays accurate
    // until the next page load
    setMyInventory((prev) =>
      prev.map((p) => {
        const sold = cart.find((c) => c.product.id === p.id);
        if (!sold) return p;
        return { ...p, stockQuantity: Math.max(0, p.stockQuantity - sold.quantity) };
      })
    );

    setCart([]);
    setSaleSuccess(true);
    setTimeout(() => {
      setSaleSuccess(false);
      setCompleting(false);
      router.push("/employee/dashboard");
    }, 1500);
  }

  // ── Success screen ──────────────────────────────────────────
  if (saleSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Sale Complete!</h2>
        <p className="text-slate-500 text-sm">Inventory updated. Heading back…</p>
      </div>
    );
  }

  const hintBarcodes = myInventory
    .filter((p) => p.stockQuantity > 0)
    .slice(0, 3)
    .map((p) => p.barcode);

  return (
    <div>
      <PageHeader title="New Sale" subtitle="Scan or type a product barcode" />

      {/* Barcode scanner input */}
      <Card className="p-4 mb-4">
        <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan or type barcode…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-slate-50"
            />
          </div>
          <Button type="submit" size="md">Add</Button>
        </form>

        {scanMessage && (
          <div className={`mt-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
            scanMessage.success
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {scanMessage.success ? "✓ " : "✗ "}{scanMessage.text}
          </div>
        )}

        {hintBarcodes.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Your products: {hintBarcodes.join(" · ")}
          </p>
        )}
      </Card>

      {/* Cart */}
      {cart.length === 0 ? (
        <Card className="p-8 text-center mb-4">
          <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-slate-400 text-sm">Cart is empty — scan a product to begin</p>
        </Card>
      ) : (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
            Cart ({cartItemCount} unit{cartItemCount !== 1 ? "s" : ""})
          </p>
          <div className="space-y-2">
            {cart.map((item) => {
              const maxQty = myInventory.find((p) => p.id === item.product.id)?.stockQuantity ?? 0;
              return (
                <Card key={item.product.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{item.product.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{item.product.barcode}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 p-0.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm transition-colors">−</button>
                      <span className="text-sm font-bold text-slate-800 w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, item.quantity + 1)} disabled={item.quantity >= maxQty} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">+</button>
                      <span className="text-xs text-slate-400 ml-1">/ {maxQty} in stock</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {formatCurrency(Number(item.product.price) * item.quantity)}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{formatCurrency(Number(item.product.price))} each</p>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Checkout panel */}
      {cart.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
            <span className="text-sm text-slate-500">Subtotal</span>
            <span className="text-sm font-medium text-slate-700">{formatCurrency(cartTotal)}</span>
          </div>
          <div className="flex items-center justify-between mb-5">
            <span className="font-bold text-slate-800">Total</span>
            <span className="text-xl font-bold text-indigo-600">{formatCurrency(cartTotal)}</span>
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Payment Method</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                onClick={() => setSelectedPayment(method)}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border-2 text-center transition-all ${
                  selectedPayment === method
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className="text-lg mb-0.5">{paymentIcons[method]}</span>
                <span className="text-[10px] font-semibold leading-tight">{method}</span>
              </button>
            ))}
          </div>

          <Button fullWidth size="lg" onClick={handleCompleteSale} disabled={completing}>
            {completing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Complete Sale · {formatCurrency(cartTotal)}
              </>
            )}
          </Button>
        </Card>
      )}
    </div>
  );
}
