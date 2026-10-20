"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stats } from "@/components/ui/Stats";
import { Panel } from "@/components/ui/Panel";
import { Empty, Loading } from "@/components/ui/States";
import { SalesList, type SaleWithItems } from "@/components/SalesList";

export default function EmployeeSalesHistory() {
  const supabase = createClient();

  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [productNames, setProductNames] = useState(new Map<string, string>());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Row-level security limits this to the signed-in employee's own sales.
      const [{ data: saleRows }, { data: products }] = await Promise.all([
        supabase.from("sales").select("*, sale_items(*)").order("created_at", { ascending: false }),
        supabase.from("products").select("id, name"),
      ]);

      setSales((saleRows as SaleWithItems[]) ?? []);
      setProductNames(new Map((products ?? []).map((p) => [p.id, p.name])));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;

  const revenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const units = sales.reduce((sum, s) => sum + s.sale_items.reduce((n, i) => n + i.quantity, 0), 0);

  return (
    <div>
      <PageHeader title="History" />

      <div className="mb-5">
        <Stats
          items={[
            { label: "Sales", value: String(sales.length) },
            { label: "Revenue", value: formatCurrency(revenue) },
            { label: "Units sold", value: String(units) },
          ]}
        />
      </div>

      {sales.length === 0 ? (
        <Panel>
          <Empty title="No sales yet">
            <Link href="/employee/new-sale" className="font-medium text-pine underline-offset-2 hover:underline">
              Make your first sale
            </Link>
          </Empty>
        </Panel>
      ) : (
        <SalesList sales={sales} productNames={productNames} />
      )}
    </div>
  );
}
