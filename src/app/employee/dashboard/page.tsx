"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbSale, ProductWithStock } from "@/types";

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate();
}

export default function EmployeeDashboard() {
  const supabase = createClient();

  const [inventory, setInventory] = useState<ProductWithStock[]>([]);
  const [sales, setSales]         = useState<DbSale[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch assigned inventory joined with product details
      const { data: invRows } = await supabase
        .from("employee_inventory")
        .select("quantity, products(*)")
        .eq("employee_id", user.id);

      const inv: ProductWithStock[] = (invRows ?? []).map((row: any) => ({
        ...row.products,
        stockQuantity: row.quantity,
      }));

      // Fetch this employee's sales (RLS enforces employee_id = auth.uid())
      const { data: saleRows } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      setInventory(inv);
      setSales(saleRows ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todaysSales  = sales.filter((s) => isToday(s.created_at));
  const todaysTotal  = todaysSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const lowStock     = inventory.filter((p) => p.stockQuantity <= p.low_stock_limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Today's Revenue"
          value={formatCurrency(todaysTotal)}
          iconBg="bg-indigo-100"
          icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Sales Today"
          value={String(todaysSales.length)}
          iconBg="bg-emerald-100"
          sub="transactions"
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
      </div>

      {/* New Sale CTA */}
      <Link href="/employee/new-sale">
        <Card className="p-5 bg-indigo-600 border-0 mb-6 cursor-pointer hover:bg-indigo-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-200 text-sm font-medium mb-1">Ready to sell?</p>
              <p className="text-white text-lg font-bold">Start a New Sale</p>
            </div>
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
          </div>
        </Card>
      </Link>

      {/* Low Stock */}
      <PageHeader
        title="My Low Stock"
        subtitle={lowStock.length === 0 ? "All stocked up!" : `${lowStock.length} item${lowStock.length !== 1 ? "s" : ""} running low`}
        action={
          <Link href="/employee/inventory">
            <Button variant="ghost" size="sm" className="text-indigo-600">View all</Button>
          </Link>
        }
      />

      {lowStock.length === 0 ? (
        <Card className="p-6 text-center mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">All your products are well stocked!</p>
        </Card>
      ) : (
        <div className="space-y-2 mb-6">
          {lowStock.map((p) => (
            <Card key={p.id} className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.category}</p>
              </div>
              <Badge variant={p.stockQuantity === 0 ? "danger" : "warning"}>
                {p.stockQuantity === 0 ? "Out of stock" : `${p.stockQuantity} left`}
              </Badge>
            </Card>
          ))}
        </div>
      )}

      {/* Today's sales */}
      {todaysSales.length > 0 && (
        <>
          <PageHeader
            title="Today's Sales"
            action={
              <Link href="/employee/sales-history">
                <Button variant="ghost" size="sm" className="text-indigo-600">See all</Button>
              </Link>
            }
          />
          <div className="space-y-2">
            {todaysSales.slice(0, 3).map((sale) => (
              <Card key={sale.id} className="p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">
                    {new Date(sale.created_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(Number(sale.total_amount))}</p>
                  <Badge variant="neutral" className="mt-0.5">{sale.payment_method}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
