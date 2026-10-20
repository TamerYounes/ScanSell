"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { classNames, formatCurrency } from "@/lib/utils";
import { normalizeBarcode } from "@/lib/barcode";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button, buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Empty, Loading, Notice } from "@/components/ui/States";
import type { PaymentMethod, ProductWithStock } from "@/types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Card", "E-transfer", "Other"];

type Line = { product: ProductWithStock; quantity: number };

function Cart({
  lines,
  payment,
  onPayment,
  onQuantity,
  onComplete,
  completing,
}: {
  lines: Line[];
  payment: PaymentMethod;
  onPayment: (method: PaymentMethod) => void;
  onQuantity: (productId: string, quantity: number) => void;
  onComplete: () => void;
  completing: boolean;
}) {
  const total = lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0);

  if (lines.length === 0) {
    return <Empty title="Cart is empty">Scan a barcode or tap a product.</Empty>;
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        {lines.map(({ product, quantity }) => (
          <li key={product.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm text-ink">{product.name}</p>
              <p className="text-sm font-medium text-ink">{formatCurrency(Number(product.price) * quantity)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center rounded border border-line">
                <button
                  type="button"
                  onClick={() => onQuantity(product.id, quantity - 1)}
                  className="h-8 w-9 text-lg text-muted hover:text-ink"
                  aria-label={`One less ${product.name}`}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => onQuantity(product.id, quantity + 1)}
                  disabled={quantity >= product.stockQuantity}
                  className="h-8 w-9 text-lg text-muted hover:text-ink disabled:opacity-30"
                  aria-label={`One more ${product.name}`}
                >
                  +
                </button>
              </div>
              <span className="text-xs text-muted">{formatCurrency(Number(product.price))} each</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-4 py-4">
        <p className="mb-2 text-xs text-muted">Paid by</p>
        <div className="grid grid-cols-4 gap-1 rounded border border-line bg-paper p-1" role="radiogroup">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={payment === method}
              onClick={() => onPayment(method)}
              className={classNames(
                "rounded-sm py-1.5 text-xs",
                payment === method ? "bg-white font-medium text-ink shadow-[0_0_0_1px_#DDE1DC]" : "text-muted",
              )}
            >
              {method}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="text-xl font-semibold text-ink">{formatCurrency(total)}</span>
        </div>

        <Button size="lg" fullWidth className="mt-3" onClick={onComplete} disabled={completing}>
          {completing ? "Saving…" : `Complete sale`}
        </Button>
      </div>
    </div>
  );
}

export default function NewSalePage() {
  const supabase = createClient();

  const [stock, setStock] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Cash");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [saved, setSaved] = useState<{ total: number; payment: PaymentMethod } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadStock = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("employee_inventory")
      .select("quantity, products(*)")
      .eq("employee_id", user.id);

    setStock(
      (data ?? [])
        .filter((row) => row.products)
        .map((row) => ({ ...row.products!, stockQuantity: row.quantity }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const lines: Line[] = useMemo(
    () =>
      [...cart.entries()]
        .map(([id, quantity]) => ({ product: stock.find((p) => p.id === id)!, quantity }))
        .filter((l) => l.product),
    [cart, stock],
  );
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  const total = lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0);

  const term = search.trim().toLowerCase();
  const shown = stock.filter((p) => `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(term));

  function setQuantity(productId: string, quantity: number) {
    const product = stock.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) => {
      const next = new Map(prev);
      if (quantity <= 0) next.delete(productId);
      else next.set(productId, Math.min(quantity, product.stockQuantity));
      return next;
    });
  }

  function add(product: ProductWithStock) {
    const inCart = cart.get(product.id) ?? 0;

    if (inCart >= product.stockQuantity) {
      setMessage({
        text: `You only have ${product.stockQuantity} of ${product.name}.`,
        ok: false,
      });
      return;
    }

    setQuantity(product.id, inCart + 1);
    setMessage({ text: `Added ${product.name}.`, ok: true });
  }

  function addByBarcode(code: string) {
    const barcode = normalizeBarcode(code);
    const product = stock.find((p) => p.barcode === barcode);

    if (!product) {
      setMessage({ text: `${barcode} isn't in your stock.`, ok: false });
      return false;
    }

    add(product);
    return true;
  }

  // USB and Bluetooth scanners type the code and press Enter.
  function handleSearchKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !search.trim()) return;

    if (addByBarcode(search) || (shown.length === 1 && (add(shown[0]), true))) {
      setSearch("");
    }
  }

  async function completeSale() {
    if (lines.length === 0) return;
    setCompleting(true);

    const res = await fetch("/api/complete-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_method: payment,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      }),
    });
    const json = await res.json().catch(() => ({}));

    setCompleting(false);

    if (!res.ok) {
      setSheetOpen(false);
      setMessage({ text: json.error ?? "The sale didn't save. Try again.", ok: false });
      return;
    }

    setSaved({ total, payment });
    setCart(new Map());
    setSheetOpen(false);
    setMessage(null);
    loadStock();
  }

  if (loading) return <Loading />;

  if (saved) {
    return (
      <div className="mx-auto max-w-sm pt-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pine-light text-pine">
          <Icon name="check" className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">Sale saved</h1>
        <p className="mt-1 text-sm text-muted">
          {formatCurrency(saved.total)}, paid by {saved.payment.toLowerCase()}
        </p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={() => setSaved(null)}>
            Start the next sale
          </Button>
          <Link href="/employee/sales-history" className={buttonClass("ghost", "lg")}>
            View history
          </Link>
        </div>
      </div>
    );
  }

  const cartProps = {
    lines,
    payment,
    onPayment: setPayment,
    onQuantity: setQuantity,
    onComplete: completeSale,
    completing,
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <div>
        <PageHeader title="New sale" />

        <Button size="lg" fullWidth onClick={() => setScanning(true)}>
          <Icon name="scan" />
          Scan barcode
        </Button>

        <div className="relative mt-3">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Or search name or barcode"
            className="field pl-9"
            enterKeyHint="search"
          />
        </div>

        {message && (
          <div className="mt-3">
            <Notice tone={message.ok ? "success" : "error"}>{message.text}</Notice>
          </div>
        )}

        <Panel className="mt-4">
          {stock.length === 0 ? (
            <Empty title="You don't have any stock to sell">Ask your manager to assign some.</Empty>
          ) : shown.length === 0 ? (
            <Empty title={`Nothing matches "${search}"`} />
          ) : (
            shown.map((product) => {
              const inCart = cart.get(product.id) ?? 0;
              const left = product.stockQuantity - inCart;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => add(product)}
                  disabled={product.stockQuantity === 0}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper disabled:opacity-40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{product.name}</span>
                    <span className="block text-xs text-muted">
                      {left} left
                      <span className="ml-2 text-faint">{product.barcode}</span>
                    </span>
                  </span>
                  <span className="text-sm text-ink">{formatCurrency(Number(product.price))}</span>
                  <span
                    className={classNames(
                      "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm",
                      inCart > 0 ? "bg-pine font-medium text-white" : "border border-line text-muted",
                    )}
                    aria-label={inCart > 0 ? `${inCart} in cart` : "Add"}
                  >
                    {inCart > 0 ? inCart : "+"}
                  </span>
                </button>
              );
            })
          )}
        </Panel>

        {count > 0 && <div className="h-20 lg:hidden" />}
      </div>

      <aside className="hidden lg:sticky lg:top-8 lg:block">
        <Panel title={count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart"}>
          <Cart {...cartProps} />
        </Panel>
      </aside>

      {/* Phone: cart summary above the tabs, opens the full cart */}
      {count > 0 && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{formatCurrency(total)}</p>
              <p className="text-xs text-muted">
                {count} {count === 1 ? "item" : "items"}
              </p>
            </div>
            <Button onClick={() => setSheetOpen(true)}>Review sale</Button>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/40 lg:hidden" onClick={() => setSheetOpen(false)}>
          <div
            role="dialog"
            aria-label="Cart"
            className="safe-bottom max-h-[88vh] w-full overflow-y-auto rounded-t-lg bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Cart</h2>
              <button onClick={() => setSheetOpen(false)} className="text-muted hover:text-ink" aria-label="Close cart">
                <Icon name="close" />
              </button>
            </div>
            <Cart {...cartProps} />
          </div>
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={(code) => {
            setScanning(false);
            addByBarcode(code);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
