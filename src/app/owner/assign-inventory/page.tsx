"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbProfile, DbProduct } from "@/types";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface CurrentStock {
  product_id: string;
  quantity: number;
}

export default function AssignInventoryPage() {
  const supabase = createClient();

  const [employees, setEmployees]       = useState<DbProfile[]>([]);
  const [products, setProducts]         = useState<DbProduct[]>([]);
  const [selectedEmp, setSelectedEmp]   = useState<DbProfile | null>(null);
  const [currentStock, setCurrentStock] = useState<CurrentStock[]>([]);
  const [quantities, setQuantities]     = useState<Record<string, number>>({});
  const [saving, setSaving]             = useState<string | null>(null); // product_id being saved
  const [message, setMessage]           = useState<{ text: string; success: boolean } | null>(null);
  const [loading, setLoading]           = useState(true);
  const [stockLoading, setStockLoading] = useState(false);

  // Load employees and products once
  useEffect(() => {
    async function load() {
      const { data: empRows } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "employee")
        .eq("is_active", true)
        .order("full_name");

      const { data: prodRows } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");

      setEmployees(empRows ?? []);
      setProducts(prodRows ?? []);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load current stock when employee is selected
  async function handleSelectEmployee(emp: DbProfile) {
    setSelectedEmp(emp);
    setMessage(null);
    setStockLoading(true);

    const { data } = await supabase
      .from("employee_inventory")
      .select("product_id, quantity")
      .eq("employee_id", emp.id);

    const stock: CurrentStock[] = (data ?? []).map((r) => ({
      product_id: r.product_id,
      quantity:   r.quantity,
    }));

    // Pre-fill quantities with existing stock values
    const qty: Record<string, number> = {};
    for (const row of stock) {
      qty[row.product_id] = row.quantity;
    }
    // Products not yet assigned default to 0
    for (const p of products) {
      if (!(p.id in qty)) qty[p.id] = 0;
    }

    setCurrentStock(stock);
    setQuantities(qty);
    setStockLoading(false);
  }

  // Save a single product's quantity
  async function handleSave(product: DbProduct) {
    if (!selectedEmp) return;
    setSaving(product.id);
    setMessage(null);

    const qty = quantities[product.id] ?? 0;

    const res = await fetch("/api/assign-inventory", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: selectedEmp.id,
        product_id:  product.id,
        quantity:    qty,
        note:        `Owner set to ${qty} unit${qty !== 1 ? "s" : ""}`,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setMessage({ text: json.error ?? "Failed to save.", success: false });
    } else {
      // The database moved the difference between the warehouse and the employee.
      const delta = qty - getCurrentQty(product.id);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, warehouse_stock: p.warehouse_stock - delta } : p
        )
      );

      // Update local stock snapshot
      setCurrentStock((prev) => {
        const exists = prev.find((r) => r.product_id === product.id);
        if (exists) {
          return prev.map((r) =>
            r.product_id === product.id ? { ...r, quantity: qty } : r
          );
        }
        return [...prev, { product_id: product.id, quantity: qty }];
      });
      setMessage({ text: `Saved ${qty} unit${qty !== 1 ? "s" : ""} of "${product.name}" for ${selectedEmp.full_name}.`, success: true });
    }

    setSaving(null);

    // Auto-clear message after 3s
    setTimeout(() => setMessage(null), 3000);
  }

  function getCurrentQty(productId: string): number {
    return currentStock.find((r) => r.product_id === productId)?.quantity ?? 0;
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
        title="Assign Inventory"
        subtitle="Set stock quantities per employee"
      />

      {/* Employee selector */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        Select Employee
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
        {employees.map((emp) => {
          const isSelected = selectedEmp?.id === emp.id;
          return (
            <button
              key={emp.id}
              onClick={() => handleSelectEmployee(emp)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <div className={`w-6 h-6 ${emp.avatar_color} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
                {getInitials(emp.full_name)}
              </div>
              {emp.full_name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* No employee selected */}
      {!selectedEmp && (
        <Card className="p-8 text-center">
          <svg className="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-slate-400 text-sm">Select an employee above to manage their inventory.</p>
        </Card>
      )}

      {/* Stock loading spinner */}
      {selectedEmp && stockLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Product list */}
      {selectedEmp && !stockLoading && (
        <>
          {/* Message banner */}
          {message && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
              message.success
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {message.success ? "✓ " : "✗ "}{message.text}
            </div>
          )}

          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className={`w-8 h-8 ${selectedEmp.avatar_color} rounded-xl flex items-center justify-center text-white text-sm font-bold`}>
              {getInitials(selectedEmp.full_name)}
            </div>
            <p className="text-sm font-bold text-slate-800">{selectedEmp.full_name}</p>
            <span className="text-xs text-slate-400">— set quantities below</span>
          </div>

          <div className="space-y-2">
            {products.map((product) => {
              const currentQty  = getCurrentQty(product.id);
              const pendingQty  = quantities[product.id] ?? 0;
              const maxQty      = currentQty + product.warehouse_stock;
              const isDirty     = pendingQty !== currentQty;
              const overLimit   = pendingQty > maxQty;
              const isSaving    = saving === product.id;

              return (
                <Card key={product.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-mono text-slate-400">{product.barcode}</span>
                        <Badge variant="neutral">{product.category}</Badge>
                        <span className="text-xs text-slate-500 font-medium">
                          {formatCurrency(Number(product.price))}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${overLimit ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                        {product.warehouse_stock} in warehouse
                        {overLimit && ` · max ${maxQty} for ${selectedEmp.full_name.split(" ")[0]}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">Currently</p>
                      <p className={`text-lg font-bold ${
                        currentQty === 0 ? "text-slate-300" :
                        currentQty <= product.low_stock_limit ? "text-amber-500" :
                        "text-emerald-600"
                      }`}>
                        {currentQty}
                      </p>
                    </div>
                  </div>

                  {/* Quantity controls + save */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: Math.max(0, (prev[product.id] ?? 0) - 1),
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={pendingQty}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: isNaN(v) || v < 0 ? 0 : v,
                          }));
                        }}
                        className="w-16 text-center text-sm font-bold text-slate-800 border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <button
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: Math.min(maxQty, (prev[product.id] ?? 0) + 1),
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition-colors"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-400">units</span>
                    </div>

                    <Button
                      size="sm"
                      variant={isDirty ? "primary" : "secondary"}
                      onClick={() => handleSave(product)}
                      disabled={isSaving || !isDirty || overLimit}
                    >
                      {isSaving ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : isDirty ? "Save" : "Saved"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
