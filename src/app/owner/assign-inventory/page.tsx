"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { classNames } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, Row } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Empty, Loading, Notice } from "@/components/ui/States";
import type { DbProduct, DbProfile } from "@/types";

function AssignStock() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [sellers, setSellers] = useState<DbProfile[]>([]);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [seller, setSeller] = useState<DbProfile | null>(null);
  const [held, setHeld] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: people }, { data: productRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "employee").eq("is_active", true).order("full_name"),
        supabase.from("products").select("*").eq("is_active", true).order("name"),
      ]);

      setSellers(people ?? []);
      setProducts(productRows ?? []);
      setLoading(false);

      const preselect = (people ?? []).find((p) => p.id === searchParams.get("employee"));
      if (preselect) selectSeller(preselect);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectSeller(next: DbProfile) {
    setSeller(next);
    setMessage(null);
    setLoadingStock(true);

    const { data } = await supabase
      .from("employee_inventory")
      .select("product_id, quantity")
      .eq("employee_id", next.id);

    const current = Object.fromEntries((data ?? []).map((r) => [r.product_id, r.quantity]));
    setHeld(current);
    setDraft(current);
    setLoadingStock(false);
  }

  async function save(product: DbProduct) {
    if (!seller) return;

    const quantity = draft[product.id] ?? 0;
    setSaving(product.id);
    setMessage(null);

    const res = await fetch("/api/assign-inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: seller.id,
        product_id: product.id,
        quantity,
        note: `Set to ${quantity}`,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(null);

    if (!res.ok) {
      setMessage({ text: json.error ?? "That didn't save. Try again.", ok: false });
      return;
    }

    // The database moved the difference between the warehouse and the seller.
    const delta = quantity - (held[product.id] ?? 0);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, warehouse_stock: p.warehouse_stock - delta } : p)),
    );
    setHeld((prev) => ({ ...prev, [product.id]: quantity }));
    setMessage({
      text: `${seller.full_name.split(" ")[0]} now has ${quantity} ${product.name}.`,
      ok: true,
    });
  }

  function setQuantity(product: DbProduct, value: number) {
    const max = (held[product.id] ?? 0) + product.warehouse_stock;
    setDraft((prev) => ({ ...prev, [product.id]: Math.max(0, Math.min(max, value)) }));
  }

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Assign stock"
        subtitle="Raising a number takes stock from the warehouse. Lowering it puts stock back."
      />

      {sellers.length === 0 ? (
        <Panel>
          <Empty title="No one on the team yet">Invite a seller from the Team page first.</Empty>
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {sellers.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSeller(s)}
                aria-pressed={seller?.id === s.id}
                className={classNames(
                  "flex flex-shrink-0 items-center gap-2 rounded border bg-white py-1.5 pl-1.5 pr-3 text-sm",
                  seller?.id === s.id ? "border-pine font-medium text-ink" : "border-line text-muted hover:text-ink",
                )}
              >
                <Avatar name={s.full_name} size="sm" />
                {s.full_name}
              </button>
            ))}
          </div>

          {message && (
            <div className="mb-4">
              <Notice tone={message.ok ? "success" : "error"}>{message.text}</Notice>
            </div>
          )}

          {!seller ? (
            <Panel>
              <Empty title="Pick a seller">Then set how many of each product they carry.</Empty>
            </Panel>
          ) : loadingStock ? (
            <Loading />
          ) : (
            <Panel title={`What ${seller.full_name.split(" ")[0]} carries`}>
              {products.length === 0 ? (
                <Empty title="No products yet">Add products first.</Empty>
              ) : (
                products.map((product) => {
                  const current = held[product.id] ?? 0;
                  const value = draft[product.id] ?? 0;
                  const dirty = value !== current;
                  const max = current + product.warehouse_stock;

                  return (
                    <Row key={product.id} className="gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-ink">{product.name}</p>
                        <p className="text-xs text-muted">{product.warehouse_stock} in warehouse</p>
                      </div>
                      <div className="flex items-center rounded border border-line">
                        <button
                          onClick={() => setQuantity(product, value - 1)}
                          className="h-9 w-8 text-lg text-muted hover:text-ink"
                          aria-label={`One less ${product.name}`}
                        >
                          −
                        </button>
                        <input
                          value={value}
                          inputMode="numeric"
                          onChange={(e) => setQuantity(product, parseInt(e.target.value, 10) || 0)}
                          className="h-9 w-10 border-x border-line text-center text-sm font-medium focus:outline-none"
                          aria-label={`${product.name} quantity`}
                        />
                        <button
                          onClick={() => setQuantity(product, value + 1)}
                          disabled={value >= max}
                          className="h-9 w-8 text-lg text-muted hover:text-ink disabled:opacity-30"
                          aria-label={`One more ${product.name}`}
                        >
                          +
                        </button>
                      </div>
                      {dirty ? (
                        <Button
                          size="sm"
                          disabled={saving === product.id}
                          onClick={() => save(product)}
                          className="w-14 px-0"
                        >
                          {saving === product.id ? "…" : "Save"}
                        </Button>
                      ) : (
                        <span className="hidden w-14 sm:block" aria-hidden />
                      )}
                    </Row>
                  );
                })
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

export default function AssignStockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssignStock />
    </Suspense>
  );
}
