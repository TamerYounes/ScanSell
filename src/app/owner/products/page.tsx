"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { normalizeBarcode } from "@/lib/barcode";
import {
  emptyProductForm,
  parseProductForm,
  type ProductForm,
  type ProductFormErrors,
} from "@/lib/products";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { DbProduct } from "@/types";

type Editing = { id: string | null; form: ProductForm };

function toForm(product: DbProduct): ProductForm {
  return {
    name: product.name,
    barcode: product.barcode,
    category: product.category,
    price: String(product.price),
    warehouseStock: String(product.warehouse_stock),
    lowStockLimit: String(product.low_stock_limit),
  };
}

const fields: { key: keyof ProductForm; label: string; inputMode?: "decimal" | "numeric" }[] = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price", inputMode: "decimal" },
  { key: "warehouseStock", label: "Warehouse stock", inputMode: "numeric" },
  { key: "lowStockLimit", label: "Low stock warning at", inputMode: "numeric" },
];

export default function OwnerProductsPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<ProductFormErrors & { form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState<"search" | "form" | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("products").select("*").order("name");
      setProducts(data ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (showInactive || p.is_active) &&
        (!term || `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(term)),
    );
  }, [products, search, showInactive]);

  function openNew(barcode = "") {
    setErrors({});
    setEditing({ id: null, form: { ...emptyProductForm, barcode } });
  }

  function openEdit(product: DbProduct) {
    setErrors({});
    setEditing({ id: product.id, form: toForm(product) });
  }

  // Scanning from the list opens the product if it exists, or starts a new one.
  function handleSearchScan(code: string) {
    setScanning(null);
    const barcode = normalizeBarcode(code);
    const existing = products.find((p) => p.barcode === barcode);

    if (existing) openEdit(existing);
    else openNew(barcode);
  }

  function handleFormScan(code: string) {
    setScanning(null);
    setEditing((current) =>
      current ? { ...current, form: { ...current.form, barcode: normalizeBarcode(code) } } : current,
    );
  }

  async function handleSave() {
    if (!editing) return;

    const parsed = parseProductForm(editing.form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setSaving(true);
    setErrors({});

    const query = editing.id
      ? supabase.from("products").update(parsed.product).eq("id", editing.id)
      : supabase.from("products").insert(parsed.product);

    const { data, error } = await query.select().single<DbProduct>();

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        const other = products.find((p) => p.barcode === parsed.product.barcode);
        setErrors({
          barcode: `Already used by ${other ? `"${other.name}"` : "another product"}.`,
        });
      } else {
        setErrors({ form: "Couldn't save the product. Try again." });
      }
      return;
    }

    setProducts((prev) =>
      (editing.id ? prev.map((p) => (p.id === data.id ? data : p)) : [...prev, data]).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setEditing(null);
  }

  async function toggleActive(product: DbProduct) {
    const { data, error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id)
      .select()
      .single<DbProduct>();

    if (!error && data) {
      setProducts((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      setEditing(null);
    }
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
        title="Products"
        subtitle={`${products.filter((p) => p.is_active).length} active`}
        action={
          <button
            onClick={() => openNew()}
            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add
          </button>
        }
      />

      <div className="flex gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, barcode or category"
          className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <Button variant="outline" onClick={() => setScanning("search")}>
          Scan
        </Button>
      </div>

      <label className="flex items-center gap-2 mb-4 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Show inactive products
      </label>

      {visible.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">
            {products.length === 0
              ? "No products yet. Add one, or scan a barcode to start."
              : "No products match that search."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((product) => (
            <Card key={product.id} className="p-3.5" onClick={() => openEdit(product)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{product.barcode}</span>
                    <Badge variant="neutral">{product.category}</Badge>
                    {!product.is_active && <Badge variant="neutral">Inactive</Badge>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-800">
                    {formatCurrency(Number(product.price))}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      product.warehouse_stock <= product.low_stock_limit
                        ? "text-amber-600 font-semibold"
                        : "text-slate-500"
                    }`}
                  >
                    {product.warehouse_stock} in warehouse
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">
                {editing.id ? "Edit product" : "New product"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Barcode</label>
                <div className="flex gap-2">
                  <input
                    value={editing.form.barcode}
                    onChange={(e) =>
                      setEditing({ ...editing, form: { ...editing.form, barcode: e.target.value } })
                    }
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <Button variant="outline" onClick={() => setScanning("form")}>
                    Scan
                  </Button>
                </div>
                {errors.barcode && <p className="mt-1 text-xs text-red-600">{errors.barcode}</p>}
              </div>

              {fields.map(({ key, label, inputMode }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    value={editing.form[key]}
                    inputMode={inputMode}
                    onChange={(e) =>
                      setEditing({ ...editing, form: { ...editing.form, [key]: e.target.value } })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>}
                </div>
              ))}

              {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}

              <Button fullWidth onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing.id ? "Save changes" : "Add product"}
              </Button>

              {editing.id && (
                <Button
                  fullWidth
                  variant="ghost"
                  onClick={() => {
                    const product = products.find((p) => p.id === editing.id);
                    if (product) toggleActive(product);
                  }}
                >
                  {products.find((p) => p.id === editing.id)?.is_active
                    ? "Deactivate product"
                    : "Reactivate product"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={scanning === "search" ? handleSearchScan : handleFormScan}
          onClose={() => setScanning(null)}
        />
      )}
    </div>
  );
}
