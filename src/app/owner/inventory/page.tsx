"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbProfile, DbProduct, ProductWithStock } from "@/types";

type ViewMode = "by-employee" | "by-product";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface EmployeeInvRow {
  employee: DbProfile;
  products: ProductWithStock[];
}

interface ProductInvRow {
  product: DbProduct;
  assignments: { employee: DbProfile; stockQuantity: number }[];
}

export default function OwnerInventoryPage() {
  const supabase = createClient();

  const [byEmployee, setByEmployee] = useState<EmployeeInvRow[]>([]);
  const [byProduct, setByProduct]   = useState<ProductInvRow[]>([]);
  const [viewMode, setViewMode]     = useState<ViewMode>("by-employee");
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      const { data: empRows } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "employee")
        .order("full_name");

      const { data: prodRows } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");

      const { data: invRows } = await supabase
        .from("employee_inventory")
        .select("employee_id, product_id, quantity");

      const emps:  DbProfile[] = empRows  ?? [];
      const prods: DbProduct[] = prodRows ?? [];
      const inv                = invRows  ?? [];

      // Build by-employee view
      const empView: EmployeeInvRow[] = emps.map((emp) => {
        const empInv = inv.filter((r) => r.employee_id === emp.id);
        const products: ProductWithStock[] = empInv.map((r) => {
          const prod = prods.find((p) => p.id === r.product_id)!;
          return { ...prod, stockQuantity: r.quantity };
        }).filter(Boolean);
        return { employee: emp, products };
      });

      // Build by-product view
      const prodView: ProductInvRow[] = prods.map((prod) => {
        const prodInv = inv.filter((r) => r.product_id === prod.id);
        const assignments = prodInv.map((r) => {
          const emp = emps.find((e) => e.id === r.employee_id)!;
          return { employee: emp, stockQuantity: r.quantity };
        }).filter((a) => a.employee);
        return { product: prod, assignments };
      }).filter((r) => r.assignments.length > 0);

      setByEmployee(empView);
      setByProduct(prodView);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Totals for subtitle
  const totalAssignments = byEmployee.reduce((s, r) => s + r.products.length, 0);
  const totalLow = byEmployee.reduce(
    (s, r) => s + r.products.filter((p) => p.stockQuantity <= p.low_stock_limit).length, 0
  );
  const totalOut = byEmployee.reduce(
    (s, r) => s + r.products.filter((p) => p.stockQuantity === 0).length, 0
  );

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
        title="All Inventory"
        subtitle={`${totalAssignments} assignments · ${totalLow} low · ${totalOut} out`}
        action={
          <Link
            href="/owner/assign-inventory"
            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Assign
          </Link>
        }
      />

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        {(["by-employee", "by-product"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              viewMode === mode
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {mode === "by-employee" ? "By Employee" : "By Product"}
          </button>
        ))}
      </div>

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
          placeholder="Search…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* By Employee view */}
      {viewMode === "by-employee" && (
        <div className="space-y-4">
          {byEmployee.map(({ employee, products }) => {
            const filtered = products.filter(
              (p) =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.barcode.includes(search)
            );
            if (search && filtered.length === 0) return null;

            return (
              <div key={employee.id}>
                <div className="flex items-center gap-2.5 mb-2 px-1">
                  <div className={`w-7 h-7 ${employee.avatar_color} rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {getInitials(employee.full_name)}
                  </div>
                  <p className="text-sm font-bold text-slate-700">{employee.full_name}</p>
                  <span className="text-xs text-slate-400">
                    {products.length} product{products.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {filtered.length === 0 ? (
                  <Card className="p-3 text-center">
                    <p className="text-xs text-slate-400">No products assigned</p>
                  </Card>
                ) : (
                  <div className="space-y-1.5">
                    {filtered.map((product) => {
                      const isOut = product.stockQuantity === 0;
                      const isLow = !isOut && product.stockQuantity <= product.low_stock_limit;
                      return (
                        <Card key={product.id} className="p-3.5 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-mono text-slate-400">{product.barcode}</span>
                              <span className="text-xs text-slate-400">{formatCurrency(Number(product.price))}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isOut && <Badge variant="danger">Out</Badge>}
                            {isLow && <Badge variant="warning">Low</Badge>}
                            <span className={`text-base font-bold ${isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-emerald-600"}`}>
                              {product.stockQuantity}
                            </span>
                            <span className="text-xs text-slate-400">units</span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* By Product view */}
      {viewMode === "by-product" && (
        <div className="space-y-2">
          {byProduct
            .filter(
              ({ product, assignments }) =>
                !search ||
                product.name.toLowerCase().includes(search.toLowerCase()) ||
                product.barcode.includes(search) ||
                assignments.some((a) =>
                  a.employee.full_name.toLowerCase().includes(search.toLowerCase())
                )
            )
            .map(({ product, assignments }) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="p-3.5 border-b border-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        {product.barcode} · {formatCurrency(Number(product.price))}
                      </p>
                    </div>
                    <Badge variant="neutral">{product.category}</Badge>
                  </div>
                </div>
                <div className="px-3.5 py-2 space-y-1.5 bg-slate-50">
                  {assignments.map(({ employee, stockQuantity }) => {
                    const isOut = stockQuantity === 0;
                    const isLow = !isOut && stockQuantity <= product.low_stock_limit;
                    return (
                      <div key={employee.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 ${employee.avatar_color} rounded flex items-center justify-center text-white text-[9px] font-bold`}>
                            {getInitials(employee.full_name)}
                          </div>
                          <span className="text-xs font-medium text-slate-600">{employee.full_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isOut && <Badge variant="danger">Out</Badge>}
                          {isLow && <Badge variant="warning">Low</Badge>}
                          <span className={`text-sm font-bold ${isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-emerald-600"}`}>
                            {stockQuantity}
                          </span>
                          <span className="text-xs text-slate-400">units</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
