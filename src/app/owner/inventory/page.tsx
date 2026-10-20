"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { classNames } from "@/lib/utils";
import { sellerStockLevel, warehouseStockLevel } from "@/lib/stock";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, Row } from "@/components/ui/Panel";
import { StockBadge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Empty, Loading } from "@/components/ui/States";
import type { DbProduct, DbProfile } from "@/types";

type View = "product" | "seller";

interface Holding {
  employee_id: string;
  product_id: string;
  quantity: number;
}

export default function OwnerStockPage() {
  const supabase = createClient();

  const [sellers, setSellers] = useState<DbProfile[]>([]);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [view, setView] = useState<View>("product");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: people }, { data: productRows }, { data: held }] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "employee").eq("is_active", true).order("full_name"),
        supabase.from("products").select("*").eq("is_active", true).order("name"),
        supabase.from("employee_inventory").select("employee_id, product_id, quantity"),
      ]);

      setSellers(people ?? []);
      setProducts(productRows ?? []);
      setHoldings((held ?? []).filter((h) => h.quantity > 0));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;

  const term = search.trim().toLowerCase();
  const matches = (p: DbProduct) => `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(term);
  const warehouseTotal = products.reduce((sum, p) => sum + p.warehouse_stock, 0);
  const heldTotal = holdings.reduce((sum, h) => sum + h.quantity, 0);

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle={`${warehouseTotal} in the warehouse, ${heldTotal} with sellers`}
        action={
          <Link href="/owner/assign-inventory" className={buttonClass("primary")}>
            Assign stock
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="grid grid-cols-2 gap-1 rounded border border-line bg-white p-1 sm:w-64" role="tablist">
          {(
            [
              ["product", "By product"],
              ["seller", "By seller"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={classNames(
                "rounded-sm py-1.5 text-sm",
                view === value ? "bg-pine-light font-medium text-pine-dark" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="field pl-9"
          />
        </div>
      </div>

      {view === "product" ? (
        <Panel>
          {products.filter(matches).length === 0 ? (
            <Empty title={products.length === 0 ? "No products yet" : "No products match that search"} />
          ) : (
            products.filter(matches).map((product) => {
              const holders = holdings
                .filter((h) => h.product_id === product.id)
                .map((h) => ({ ...h, seller: sellers.find((s) => s.id === h.employee_id) }))
                .filter((h) => h.seller);

              return (
                <Row key={product.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                    <p className="truncate text-xs text-muted">
                      {holders.length === 0
                        ? "No one is carrying this"
                        : holders.map((h) => `${h.seller!.full_name.split(" ")[0]} ${h.quantity}`).join(", ")}
                    </p>
                  </div>
                  <StockBadge level={warehouseStockLevel(product)} />
                  <div className="w-20 text-right">
                    <p className="text-base font-semibold text-ink">{product.warehouse_stock}</p>
                    <p className="text-[11px] text-muted">in warehouse</p>
                  </div>
                </Row>
              );
            })
          )}
        </Panel>
      ) : sellers.length === 0 ? (
        <Panel>
          <Empty title="No one on the team yet">
            <Link href="/owner/employees" className="font-medium text-pine hover:underline">
              Invite a seller
            </Link>
          </Empty>
        </Panel>
      ) : (
        <div className="space-y-4">
          {sellers.map((seller) => {
            const items = holdings
              .filter((h) => h.employee_id === seller.id)
              .map((h) => ({ ...h, product: products.find((p) => p.id === h.product_id) }))
              .filter((h): h is Holding & { product: DbProduct } => !!h.product && matches(h.product))
              .sort((a, b) => a.quantity - b.quantity);
            const units = holdings.filter((h) => h.employee_id === seller.id).reduce((s, h) => s + h.quantity, 0);

            if (term && items.length === 0) return null;

            return (
              <Panel
                key={seller.id}
                title={seller.full_name}
                description={`${units} units`}
                action={
                  <Link
                    href={`/owner/assign-inventory?employee=${seller.id}`}
                    className="text-sm font-medium text-pine hover:underline underline-offset-2"
                  >
                    Change
                  </Link>
                }
              >
                {items.length === 0 ? (
                  <Empty title="Not carrying anything" />
                ) : (
                  items.map(({ product, quantity }) => (
                    <Row key={product.id}>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{product.name}</span>
                      <StockBadge level={sellerStockLevel(quantity)} />
                      <span className="w-8 text-right text-sm font-medium text-ink">{quantity}</span>
                    </Row>
                  ))
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
