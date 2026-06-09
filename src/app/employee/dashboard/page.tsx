"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { DbSale, ProductWithStock } from "@/types";

function isToday(iso: string) {
  const d = new Date(iso); const n = new Date();
  return d.toDateString() === n.toDateString();
}

export default function EmployeeDashboard() {
  const supabase = createClient();
  const [inventory, setInventory] = useState<ProductWithStock[]>([]);
  const [sales, setSales] = useState<DbSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      const [{ data: invRows }, { data: saleRows }] = await Promise.all([
        supabase.from("employee_inventory").select("quantity, products(*)").eq("employee_id", user.id),
        supabase.from("sales").select("*").order("created_at", { ascending: false }),
      ]);
      setInventory((invRows ?? []).map((row: any) => ({ ...row.products, stockQuantity: row.quantity })));
      setSales(saleRows ?? []); setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todaysSales = sales.filter(s => isToday(s.created_at));
  const todaysTotal = todaysSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalAssigned = inventory.reduce((sum, p) => sum + p.stockQuantity, 0);
  const lowStock = inventory.filter(p => p.stockQuantity <= p.low_stock_limit);
  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0); return d; });
    return days.map(day => ({ label: day.toLocaleDateString("en-CA", { weekday: "short" }), value: sales.filter(s => new Date(s.created_at).toDateString() === day.toDateString()).length }));
  }, [sales]);
  const maxWeekly = Math.max(1, ...weekly.map(d => d.value));

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><div className="h-9 w-9 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"/></div>;

  const statCards = [
    { label: "TODAY'S SALES", value: String(todaysSales.length), sub: "transactions", tone: "blue", icon: "🛒" },
    { label: "TODAY'S REVENUE", value: formatCurrency(todaysTotal), sub: "live total", tone: "green", icon: "$" },
    { label: "ASSIGNED", value: String(totalAssigned), sub: "items left", tone: "purple", icon: "◇" },
    { label: "LOW STOCK", value: String(lowStock.length), sub: "need attention", tone: "amber", icon: "!" },
  ];

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map(card => <div key={card.label} className="app-card p-5 flex items-start justify-between"><div><p className="text-[11px] font-semibold tracking-wide text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-bold">{card.value}</p><p className="mt-1 text-xs text-slate-500">{card.sub}</p></div><div className={`grid h-11 w-11 place-items-center rounded-lg text-xl font-bold ${card.tone === "blue" ? "bg-blue-100 text-blue-700" : card.tone === "green" ? "bg-emerald-100 text-emerald-600" : card.tone === "purple" ? "bg-purple-100 text-purple-600" : "bg-amber-100 text-amber-600"}`}>{card.icon}</div></div>)}
    </div>

    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="app-card p-5 md:p-6">
        <h2 className="text-base font-bold">Weekly Performance</h2><p className="text-sm text-slate-500 mt-1">Your sales activity this week</p>
        <div className="mt-7 h-64 flex items-end gap-3 md:gap-5 border-b border-slate-200 px-2">
          {weekly.map(day => <div key={day.label} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><div className="w-full max-w-[76px] rounded-t-md bg-[#5976eb] transition-all" style={{ height: `${Math.max(day.value ? 18 : 4, (day.value / maxWeekly) * 88)}%` }} title={`${day.value} sales`}/><span className="pb-2 text-xs text-slate-500">{day.label}</span></div>)}
        </div>
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="flex items-center justify-between"><div><h2 className="text-base font-bold">Recent Sales</h2><p className="text-sm text-slate-500 mt-1">Your latest transactions</p></div><Link href="/employee/sales-history" className="text-sm font-semibold text-blue-700">View all</Link></div>
        <div className="mt-5 divide-y divide-slate-100">
          {sales.slice(0, 4).map(sale => <div key={sale.id} className="py-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{sale.payment_method}</p><p className="mt-1 text-xs text-slate-500">{new Date(sale.created_at).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p></div><div className="text-right"><span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Completed</span><p className="mt-2 text-sm font-bold">{formatCurrency(Number(sale.total_amount))}</p></div></div>)}
          {sales.length === 0 && <div className="py-10 text-center text-sm text-slate-500">No sales yet.</div>}
        </div>
      </section>
    </div>

    <section className="app-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-bold">My Assigned Inventory</h2><p className="text-sm text-slate-500 mt-1">Products currently assigned to you</p></div><Link href="/employee/new-sale" className="inline-flex justify-center rounded-lg bg-[#3b43bb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3037a5]">Start New Sale</Link></div>
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Barcode</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Remaining</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{inventory.map(p => <tr key={p.id}><td className="px-5 py-4 font-semibold">{p.name}</td><td className="px-5 py-4 text-slate-500">{p.barcode}</td><td className="px-5 py-4">{formatCurrency(Number(p.price))}</td><td className="px-5 py-4 font-semibold">{p.stockQuantity}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.stockQuantity === 0 ? "bg-red-50 text-red-700" : p.stockQuantity <= p.low_stock_limit ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{p.stockQuantity === 0 ? "Out" : p.stockQuantity <= p.low_stock_limit ? "Low" : "In stock"}</span></td></tr>)}{inventory.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No inventory assigned yet.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
