"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { normalizeBarcode } from "@/lib/barcode";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { CartItem, PaymentMethod, ProductWithStock } from "@/types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "E-transfer", "Card", "Other"];

export default function EmployeeNewSale() {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inventory, setInventory] = useState<ProductWithStock[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("employee_inventory")
        .select("quantity, products(*)")
        .eq("employee_id", user.id);

      setInventory(
        (data ?? []).map((row) => ({ ...row.products, stockQuantity: row.quantity })),
      );
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return inventory.filter((p) =>
      `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(term),
    );
  }, [inventory, search]);

  const total = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addProduct(product: ProductWithStock) {
    const existing = cart.find((item) => item.product.id === product.id);
    const inCart = existing?.quantity ?? 0;

    if (inCart >= product.stockQuantity) {
      setMessage({
        text: `Only ${product.stockQuantity} unit${product.stockQuantity === 1 ? "" : "s"} of ${product.name} available.`,
        ok: false,
      });
      return;
    }

    setCart((prev) =>
      existing
        ? prev.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...prev, { product, quantity: 1 }],
    );
    setMessage({ text: `${product.name} added to cart.`, ok: true });
  }

  /** Adds the product with this exact barcode, if the employee is holding it. */
  function addByBarcode(code: string) {
    const barcode = normalizeBarcode(code);
    const product = inventory.find((p) => p.barcode === barcode);

    if (!product) {
      setMessage({ text: `No product with barcode ${barcode} in your inventory.`, ok: false });
      return false;
    }

    addProduct(product);
    return true;
  }

  function handleScan(code: string) {
    setScanning(false);
    addByBarcode(code);
  }

  // USB and Bluetooth scanners type the code and press Enter.
  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !search.trim()) return;

    if (addByBarcode(search)) {
      setSearch("");
    } else if (filtered.length === 1) {
      addProduct(filtered[0]);
      setSearch("");
    }
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== id));
      return;
    }

    const max = inventory.find((p) => p.id === id)?.stockQuantity ?? 0;
    setCart((prev) =>
      prev.map((item) => (item.product.id === id ? { ...item, quantity: Math.min(qty, max) } : item)),
    );
  }

  async function completeSale() {
    if (!cart.length) return;
    setCompleting(true);

    const res = await fetch("/api/complete-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_method: payment,
        items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      setMessage({ text: json.error ?? "Sale failed.", ok: false });
      setCompleting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/employee/dashboard"), 1400);
  }

  if (success) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <div className="app-card max-w-sm p-10 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-5 text-2xl font-bold">Sale Complete</h2>
          <p className="mt-2 text-sm text-slate-500">Inventory has been updated.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="space-y-5">
        <section className="app-card p-5">
          <h2 className="text-base font-bold">Sale Information</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Product Search</span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg
                    className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search by name or barcode..."
                    className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Scan
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Payment Method</span>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
          </div>

          {message && (
            <div
              className={`mt-4 rounded-lg border px-3 py-2 text-sm font-medium ${
                message.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}
        </section>

        <section className="app-card p-5">
          <div>
            <h2 className="text-base font-bold">Select Products</h2>
            <p className="mt-1 text-sm text-slate-500">Choose from your assigned inventory</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                disabled={product.stockQuantity === 0}
                className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:shadow-sm disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.barcode}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      product.stockQuantity <= product.low_stock_limit
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {product.stockQuantity}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold">{formatCurrency(Number(product.price))}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-xl text-blue-700">
                    +
                  </span>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="md:col-span-2 py-12 text-center text-sm text-slate-500">
                No products found.
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="app-card h-fit xl:sticky xl:top-[118px] overflow-hidden">
        <div className="border-b border-slate-200 p-5 flex items-center justify-between">
          <h2 className="font-bold">Cart ({count})</h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs font-semibold text-red-600">
              Clear
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-50 text-slate-300">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 3h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
                  <circle cx="10" cy="20" r="1" />
                  <circle cx="18" cy="20" r="1" />
                </svg>
              </div>
              <p className="mt-4 font-semibold">Cart is empty</p>
              <p className="mt-1 text-sm text-slate-500">Scan or tap a product to add it</p>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[430px] overflow-y-auto divide-y divide-slate-100">
              {cart.map((item) => (
                <div key={item.product.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCurrency(Number(item.product.price))} each
                      </p>
                    </div>
                    <button
                      onClick={() => updateQty(item.product.id, 0)}
                      className="text-slate-400 hover:text-red-500"
                      aria-label={`Remove ${item.product.name}`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity - 1)}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity + 1)}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-bold">
                      {formatCurrency(Number(item.product.price) * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-5">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-blue-700">{formatCurrency(total)}</span>
              </div>
              <button
                onClick={completeSale}
                disabled={completing}
                className="mt-5 w-full rounded-lg bg-[#3b43bb] py-3 text-sm font-bold text-white hover:bg-[#3037a5] disabled:opacity-60"
              >
                {completing ? "Processing…" : `Complete Sale · ${formatCurrency(total)}`}
              </button>
            </div>
          </>
        )}
      </aside>

      {scanning && <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}
