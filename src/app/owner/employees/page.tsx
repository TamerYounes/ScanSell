"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbProfile, DbSale, ProductWithStock } from "@/types";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface EmployeeDetail {
  profile: DbProfile;
  inventory: ProductWithStock[];
  recentSales: DbSale[];
  totalRevenue: number;
}

export default function OwnerEmployeesPage() {
  const supabase = createClient();

  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [loading, setLoading]     = useState(true);
  const [openId, setOpenId]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: empRows } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "employee")
        .order("full_name");

      const { data: invRows } = await supabase
        .from("employee_inventory")
        .select("employee_id, quantity, products(*)");

      const { data: saleRows } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      const details: EmployeeDetail[] = (empRows ?? []).map((emp: DbProfile) => {
        const empInv = (invRows ?? [])
          .filter((r: any) => r.employee_id === emp.id)
          .map((r: any) => ({ ...r.products, stockQuantity: r.quantity }));

        const empSales = (saleRows ?? []).filter(
          (s: DbSale) => s.employee_id === emp.id
        );

        return {
          profile:      emp,
          inventory:    empInv,
          recentSales:  empSales.slice(0, 4),
          totalRevenue: empSales.reduce((s: number, sale: DbSale) => s + Number(sale.total_amount), 0),
        };
      });

      setEmployees(details);
      setOpenId(details[0]?.profile.id ?? null);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        title="Employees"
        subtitle={`${employees.length} team member${employees.length !== 1 ? "s" : ""}`}
      />

      {employees.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-400 text-sm">No employees found.</p>
          <p className="text-slate-400 text-xs mt-1">
            Add employees in the Supabase dashboard under Authentication → Users.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {employees.map(({ profile, inventory, recentSales, totalRevenue }) => {
            const lowStock = inventory.filter(
              (p) => p.stockQuantity <= p.low_stock_limit
            );
            const isOpen = openId === profile.id;

            return (
              <Card key={profile.id} className="overflow-hidden">
                {/* Header row — tap to expand */}
                <button
                  onClick={() => setOpenId(isOpen ? null : profile.id)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div className={`w-11 h-11 ${profile.avatar_color} rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {getInitials(profile.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{profile.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500">
                        {inventory.length} products · {recentSales.length} recent sales
                      </span>
                      {lowStock.length > 0 && (
                        <Badge variant="warning">{lowStock.length} low</Badge>
                      )}
                      {!profile.is_active && (
                        <Badge variant="danger">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">
                      {formatCurrency(totalRevenue)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">total revenue</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-slate-300 ml-1 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded section */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {/* Inventory */}
                    <div className="px-4 py-3 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        Assigned Inventory
                      </p>
                      {inventory.length === 0 ? (
                        <p className="text-sm text-slate-400 py-1">No products assigned.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {inventory.map((product) => {
                            const isOut = product.stockQuantity === 0;
                            const isLow = !isOut && product.stockQuantity <= product.low_stock_limit;
                            return (
                              <div
                                key={product.id}
                                className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-slate-100"
                              >
                                <div className="flex-1 min-w-0 mr-3">
                                  <p className="text-xs font-semibold text-slate-700 truncate">
                                    {product.name}
                                  </p>
                                  <p className="text-xs font-mono text-slate-400">{product.barcode}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-sm font-bold ${isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-emerald-600"}`}>
                                    {product.stockQuantity}
                                  </span>
                                  <span className="text-xs text-slate-400">units</span>
                                  {isOut && <Badge variant="danger">Out</Badge>}
                                  {isLow && <Badge variant="warning">Low</Badge>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Recent sales */}
                    {recentSales.length > 0 && (
                      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Recent Sales
                        </p>
                        <div className="space-y-1.5">
                          {recentSales.map((sale) => (
                            <div
                              key={sale.id}
                              className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-slate-100"
                            >
                              <div>
                                <p className="text-xs font-semibold text-slate-700">
                                  {new Date(sale.created_at).toLocaleTimeString("en-CA", {
                                    hour: "numeric", minute: "2-digit", hour12: true,
                                  })}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {new Date(sale.created_at).toLocaleDateString("en-CA", {
                                    month: "short", day: "numeric",
                                  })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="neutral">{sale.payment_method}</Badge>
                                <span className="text-sm font-bold text-slate-800">
                                  {formatCurrency(Number(sale.total_amount))}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
