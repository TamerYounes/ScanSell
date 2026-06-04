"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbSale, DbSaleItem, PaymentMethod } from "@/types";

const paymentColors: Record<PaymentMethod, "success" | "info" | "neutral" | "warning"> = {
  Cash: "success", "E-transfer": "info", Card: "neutral", Other: "warning",
};
const paymentIcons: Record<PaymentMethod, string> = {
  Cash: "💵", "E-transfer": "📲", Card: "💳", Other: "🔄",
};

interface SaleWithItems extends DbSale {
  sale_items: DbSaleItem[];
}

export default function EmployeeSalesHistory() {
  const supabase = createClient();

  const [sales, setSales]     = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // RLS ensures we only get this employee's own sales
      const { data } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .order("created_at", { ascending: false });

      setSales((data as SaleWithItems[]) ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalUnits   = sales.reduce(
    (sum, s) => sum + s.sale_items.reduce((a, i) => a + i.quantity, 0),
    0
  );

  // Group by date label
  const grouped: Record<string, SaleWithItems[]> = {};
  for (const sale of sales) {
    const key = new Date(sale.created_at).toLocaleDateString("en-CA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(sale);
  }

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
        title="My Sales"
        subtitle={`${sales.length} total sale${sales.length !== 1 ? "s" : ""}`}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Total Earned</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(totalRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Units Sold</p>
          <p className="text-xl font-bold text-slate-800">{totalUnits}</p>
        </Card>
      </div>

      {sales.length === 0 ? (
        <Card className="p-8 text-center">
          <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-slate-400 text-sm">No sales yet. Complete a sale to see it here.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, daySales]) => {
            const dayTotal = daySales.reduce((s, sale) => s + Number(sale.total_amount), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-xs font-semibold text-slate-500">{date}</p>
                  <p className="text-xs font-semibold text-indigo-600">{formatCurrency(dayTotal)}</p>
                </div>
                <div className="space-y-2">
                  {daySales.map((sale) => {
                    const isExpanded = expanded === sale.id;
                    const pm = sale.payment_method as PaymentMethod;
                    const unitCount = sale.sale_items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <Card key={sale.id} className="overflow-hidden" onClick={() => setExpanded(isExpanded ? null : sale.id)}>
                        <div className="p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-lg">
                              {paymentIcons[pm]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {sale.sale_items.length} item{sale.sale_items.length !== 1 ? "s" : ""} · {unitCount} units
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {new Date(sale.created_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-slate-800">{formatCurrency(Number(sale.total_amount))}</p>
                            <Badge variant={paymentColors[pm]} className="mt-0.5">{pm}</Badge>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 px-3.5 py-3 space-y-1.5">
                            {sale.sale_items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs">
                                <span className="text-slate-600 flex-1 truncate pr-2">{item.product_id}</span>
                                <span className="text-slate-400 mr-3">×{item.quantity}</span>
                                <span className="font-semibold text-slate-700">{formatCurrency(Number(item.subtotal))}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200 mt-1.5">
                              <span className="font-semibold text-slate-500">Total</span>
                              <span className="font-bold text-slate-800">{formatCurrency(Number(sale.total_amount))}</span>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
