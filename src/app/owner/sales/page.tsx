"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbProfile, DbSale, DbSaleItem, PaymentMethod } from "@/types";

const paymentColors: Record<PaymentMethod, "success" | "info" | "neutral" | "warning"> = {
  Cash: "success", "E-transfer": "info", Card: "neutral", Other: "warning",
};
const paymentIcons: Record<PaymentMethod, string> = {
  Cash: "💵", "E-transfer": "📲", Card: "💳", Other: "🔄",
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface SaleWithItems extends DbSale {
  sale_items: DbSaleItem[];
}

export default function OwnerSalesPage() {
  const supabase = createClient();

  const [employees, setEmployees]   = useState<DbProfile[]>([]);
  const [sales, setSales]           = useState<SaleWithItems[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterEmpId, setFilterEmpId] = useState<string>("all");
  const [expanded, setExpanded]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: empRows } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "employee")
        .order("full_name");

      const { data: saleRows } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .order("created_at", { ascending: false });

      setEmployees(empRows ?? []);
      setSales((saleRows as SaleWithItems[]) ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filterEmpId === "all"
    ? sales
    : sales.filter((s) => s.employee_id === filterEmpId);

  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.total_amount), 0);

  // Group by date
  const grouped: Record<string, SaleWithItems[]> = {};
  for (const sale of filtered) {
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
        title="All Sales"
        subtitle={`${filtered.length} sale${filtered.length !== 1 ? "s" : ""} · ${formatCurrency(totalRevenue)}`}
      />

      {/* Employee filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
        <button
          onClick={() => setFilterEmpId("all")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            filterEmpId === "all"
              ? "bg-indigo-600 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
          }`}
        >
          All Employees
        </button>
        {employees.map((emp) => {
          const count = sales.filter((s) => s.employee_id === emp.id).length;
          const isActive = filterEmpId === emp.id;
          return (
            <button
              key={emp.id}
              onClick={() => setFilterEmpId(emp.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className={`w-4 h-4 ${isActive ? "bg-indigo-400" : emp.avatar_color} rounded-full flex items-center justify-center text-white text-[8px] font-bold`}>
                {getInitials(emp.full_name).charAt(0)}
              </div>
              {emp.full_name.split(" ")[0]} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-400 text-sm">No sales found.</p>
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
                    const seller = employees.find((e) => e.id === sale.employee_id);
                    const isExpanded = expanded === sale.id;
                    const pm = sale.payment_method as PaymentMethod;
                    const unitCount = sale.sale_items.reduce((s, i) => s + i.quantity, 0);

                    return (
                      <Card
                        key={sale.id}
                        className="overflow-hidden"
                        onClick={() => setExpanded(isExpanded ? null : sale.id)}
                      >
                        <div className="p-3.5 flex items-center gap-3">
                          {/* Payment icon */}
                          <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                            {paymentIcons[pm]}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Seller chip */}
                            {seller && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className={`w-4 h-4 ${seller.avatar_color} rounded flex items-center justify-center text-white text-[8px] font-bold`}>
                                  {getInitials(seller.full_name).charAt(0)}
                                </div>
                                <span className="text-xs font-semibold text-slate-500">
                                  {seller.full_name}
                                </span>
                              </div>
                            )}
                            <p className="text-sm font-semibold text-slate-800">
                              {sale.sale_items.length} item{sale.sale_items.length !== 1 ? "s" : ""} · {unitCount} units
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(sale.created_at).toLocaleTimeString("en-CA", {
                                hour: "numeric", minute: "2-digit", hour12: true,
                              })}
                            </p>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-slate-800">
                              {formatCurrency(Number(sale.total_amount))}
                            </p>
                            <Badge variant={paymentColors[pm]} className="mt-0.5">
                              {pm}
                            </Badge>
                          </div>
                        </div>

                        {/* Expanded line items */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 px-3.5 py-3 space-y-1.5">
                            {sale.sale_items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-mono truncate pr-2 flex-1">
                                  {item.product_id}
                                </span>
                                <span className="text-slate-400 mr-3">×{item.quantity}</span>
                                <span className="font-semibold text-slate-700">
                                  {formatCurrency(Number(item.subtotal))}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200 mt-1.5">
                              <span className="font-semibold text-slate-500">Total</span>
                              <span className="font-bold text-slate-800">
                                {formatCurrency(Number(sale.total_amount))}
                              </span>
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
