"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import type { ProductWithStock } from "@/types";

export default function EmployeeInventoryPage() {
  const supabase = createClient();

  const [inventory, setInventory] = useState<ProductWithStock[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

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

      setInventory(inv);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = inventory.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowCount = inventory.filter((p) => p.stockQuantity <= p.low_stock_limit).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Inventory"
        subtitle={
          lowCount > 0
            ? `${inventory.length} products · ${lowCount} low`
            : `${inventory.length} products assigned`
        }
      />

      {/* Search */}
      <div className="relative mb-4">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {inventory.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm font-medium">No inventory assigned yet</p>
          <p className="text-slate-400 text-xs mt-1">Ask your manager to assign products to you.</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-slate-400 text-sm">No results for "{search}"</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => {
            const isOut = product.stockQuantity === 0;
            const isLow = !isOut && product.stockQuantity <= product.low_stock_limit;
            const pct   = Math.min(100, (product.stockQuantity / (product.low_stock_limit * 4)) * 100);

            return (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{product.name}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{product.barcode}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="neutral">{product.category}</Badge>
                      {isOut  && <Badge variant="danger">Out of stock</Badge>}
                      {isLow  && <Badge variant="warning">Low stock</Badge>}
                      {!isOut && !isLow && <Badge variant="success">In stock</Badge>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-slate-800">{formatCurrency(Number(product.price))}</p>
                    <p className={`text-xl font-bold mt-0.5 ${isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-emerald-600"}`}>
                      {product.stockQuantity}
                    </p>
                    <p className="text-xs text-slate-400">units</p>
                  </div>
                </div>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${isOut ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-emerald-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Low-stock alert at {product.low_stock_limit} units</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
