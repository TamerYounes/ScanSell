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
import { warehouseStockLevel } from "@/lib/stock";
import { Badge, StockBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, Row } from "@/components/ui/Panel";
import { Icon } from "@/components/ui/Icon";
import { Empty, Loading, Notice } from "@/components/ui/States";
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
  { key: "lowStockLimit", label: "Warn when the warehouse is down to", inputMode: "numeric" },
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

  if (loading) return <Loading />;

  const editingProduct = editing?.id ? products.find((p) => p.id === editing.id) : null;
  const activeCount = products.filter((p) => p.is_active).length;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${activeCount} active`}
        action={<Button onClick={() => openNew()}>Add product</Button>}
      />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, barcode or category"
            className="field pl-9"
          />
        </div>
        <Button variant="secondary" onClick={() => setScanning("search")} aria-label="Scan a barcode to find a product">
          <Icon name="scan" className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Scan</span>
        </Button>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="h-4 w-4 accent-[#1F5F4A]"
        />
        Show deactivated products
      </label>

      <Panel>
        {visible.length === 0 ? (
          products.length === 0 ? (
            <Empty title="No products yet">Add one, or scan a barcode to start.</Empty>
          ) : (
            <Empty title="No products match that search" />
          )
        ) : (
          visible.map((product) => (
            <Row key={product.id} onClick={() => openEdit(product)}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                  <span className="truncate">{product.name}</span>
                  {!product.is_active && <Badge>Deactivated</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {product.category}
                  <span className="ml-2 text-faint">{product.barcode}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink">{formatCurrency(Number(product.price))}</p>
                <p className="flex items-center justify-end gap-1.5 text-xs text-muted">
                  <StockBadge level={warehouseStockLevel(product)} />
                  {product.warehouse_stock} in warehouse
                </p>
              </div>
            </Row>
          ))
        )}
      </Panel>

      {editing && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            aria-label={editing.id ? "Edit product" : "Add product"}
            className="safe-bottom max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-lg bg-white sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">{editing.id ? "Edit product" : "Add product"}</h2>
              <button onClick={() => setEditing(null)} className="text-muted hover:text-ink" aria-label="Close">
                <Icon name="close" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label htmlFor="barcode" className="mb-1 block text-sm font-medium text-ink">
                  Barcode
                </label>
                <div className="flex gap-2">
                  <input
                    id="barcode"
                    value={editing.form.barcode}
                    inputMode="numeric"
                    onChange={(e) => setEditing({ ...editing, form: { ...editing.form, barcode: e.target.value } })}
                    className="field"
                  />
                  <Button variant="secondary" onClick={() => setScanning("form")} aria-label="Scan barcode">
                    <Icon name="scan" className="h-[18px] w-[18px]" />
                  </Button>
                </div>
                {errors.barcode && <p className="mt-1 text-xs text-red-700">{errors.barcode}</p>}
              </div>

              {fields.map(({ key, label, inputMode }) => (
                <div key={key}>
                  <label htmlFor={key} className="mb-1 block text-sm font-medium text-ink">
                    {label}
                  </label>
                  <input
                    id={key}
                    value={editing.form[key]}
                    inputMode={inputMode}
                    onChange={(e) => setEditing({ ...editing, form: { ...editing.form, [key]: e.target.value } })}
                    className="field"
                  />
                  {errors[key] && <p className="mt-1 text-xs text-red-700">{errors[key]}</p>}
                </div>
              ))}

              {errors.form && <Notice tone="error">{errors.form}</Notice>}

              <Button size="lg" fullWidth onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing.id ? "Save changes" : "Add product"}
              </Button>

              {editingProduct && (
                <Button variant="ghost" fullWidth onClick={() => toggleActive(editingProduct)}>
                  {editingProduct.is_active ? "Deactivate product" : "Reactivate product"}
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
