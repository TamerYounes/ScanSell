"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { sellerStockLevel } from "@/lib/stock";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, Row } from "@/components/ui/Panel";
import { StockBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Empty, Loading } from "@/components/ui/States";
import type { ProductWithStock } from "@/types";

export default function EmployeeInventoryPage() {
  const supabase = createClient();
  const [stock, setStock] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

      setStock(
        (data ?? [])
          .filter((row) => row.products)
          .map((row) => ({ ...row.products!, stockQuantity: row.quantity }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;

  const term = search.trim().toLowerCase();
  const shown = stock.filter((p) => `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(term));
  const units = stock.reduce((sum, p) => sum + p.stockQuantity, 0);

  return (
    <div>
      <PageHeader
        title="My stock"
        subtitle={`${units} units across ${stock.length} ${stock.length === 1 ? "product" : "products"}`}
      />

      {stock.length > 0 && (
        <div className="relative mb-4">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or barcode"
            className="field pl-9"
          />
        </div>
      )}

      <Panel>
        {stock.length === 0 ? (
          <Empty title="Nothing assigned to you yet">Your manager hands out stock from the warehouse.</Empty>
        ) : shown.length === 0 ? (
          <Empty title={`Nothing matches "${search}"`} />
        ) : (
          shown.map((p) => (
            <Row key={p.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                <p className="text-xs text-muted">
                  {formatCurrency(Number(p.price))}
                  <span className="ml-2 text-faint">{p.barcode}</span>
                </p>
              </div>
              <StockBadge level={sellerStockLevel(p.stockQuantity)} />
              <div className="w-12 text-right">
                <p className="text-base font-semibold text-ink">{p.stockQuantity}</p>
                <p className="text-[11px] text-muted">left</p>
              </div>
            </Row>
          ))
        )}
      </Panel>
    </div>
  );
}
