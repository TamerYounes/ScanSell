"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stats } from "@/components/ui/Stats";
import { Panel } from "@/components/ui/Panel";
import { Empty, Loading } from "@/components/ui/States";
import { SalesList, type SaleWithItems } from "@/components/SalesList";
import type { DbProfile } from "@/types";

export default function OwnerSalesPage() {
  const supabase = createClient();

  const [sellers, setSellers] = useState<DbProfile[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [productNames, setProductNames] = useState(new Map<string, string>());
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState("all");

  useEffect(() => {
    async function load() {
      const [{ data: people }, { data: saleRows }, { data: products }] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "employee").order("full_name"),
        supabase.from("sales").select("*, sale_items(*)").order("created_at", { ascending: false }),
        supabase.from("products").select("id, name"),
      ]);

      setSellers(people ?? []);
      setSales((saleRows as SaleWithItems[]) ?? []);
      setProductNames(new Map((products ?? []).map((p) => [p.id, p.name])));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(
    () => (sellerId === "all" ? sales : sales.filter((s) => s.employee_id === sellerId)),
    [sales, sellerId],
  );
  const sellerNames = useMemo(() => new Map(sellers.map((s) => [s.id, s.full_name])), [sellers]);

  if (loading) return <Loading />;

  const revenue = shown.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const units = shown.reduce((sum, s) => sum + s.sale_items.reduce((n, i) => n + i.quantity, 0), 0);

  return (
    <div>
      <PageHeader
        title="Sales"
        action={
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="field h-9 py-0 pr-8"
            aria-label="Filter by seller"
          >
            <option value="all">Everyone</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-5">
        <Stats
          items={[
            { label: "Sales", value: String(shown.length) },
            { label: "Revenue", value: formatCurrency(revenue) },
            { label: "Units sold", value: String(units) },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <Panel>
          <Empty title="No sales yet">Sales show up here as soon as your team records them.</Empty>
        </Panel>
      ) : (
        <SalesList sales={shown} productNames={productNames} sellerNames={sellerNames} />
      )}
    </div>
  );
}
