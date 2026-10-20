"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatTime } from "@/lib/utils";
import { sellerStockLevel, warehouseStockLevel, type StockLevel } from "@/lib/stock";
import { PageHeader } from "@/components/layout/PageHeader";
import { Stats } from "@/components/ui/Stats";
import { Panel, Row } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { StockBadge } from "@/components/ui/Badge";
import { Empty, Loading } from "@/components/ui/States";
import type { DbProduct, DbProfile } from "@/types";
import type { SaleWithItems } from "@/components/SalesList";

interface SellerToday {
  seller: DbProfile;
  salesToday: number;
  revenueToday: number;
  unitsHeld: number;
}

interface LowItem {
  key: string;
  product: string;
  where: string;
  quantity: number;
  level: StockLevel;
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

const linkClass = "text-sm font-medium text-pine hover:underline underline-offset-2";

export default function OwnerDashboard() {
  const supabase = createClient();

  const [team, setTeam] = useState<SellerToday[]>([]);
  const [lowItems, setLowItems] = useState<LowItem[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: people }, { data: saleRows }, { data: held }, { data: productRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "employee").eq("is_active", true).order("full_name"),
        supabase.from("sales").select("*, sale_items(*)").order("created_at", { ascending: false }),
        supabase.from("employee_inventory").select("employee_id, quantity, products(*)"),
        supabase.from("products").select("*").eq("is_active", true).order("name"),
      ]);

      const sellers = people ?? [];
      const allSales = (saleRows as SaleWithItems[]) ?? [];
      const holdings = held ?? [];
      const catalog = productRows ?? [];

      setTeam(
        sellers.map((seller) => {
          const today = allSales.filter((s) => s.employee_id === seller.id && isToday(s.created_at));
          return {
            seller,
            salesToday: today.length,
            revenueToday: today.reduce((sum, s) => sum + Number(s.total_amount), 0),
            unitsHeld: holdings
              .filter((h) => h.employee_id === seller.id)
              .reduce((sum, h) => sum + h.quantity, 0),
          };
        }),
      );

      const low: LowItem[] = [];
      for (const product of catalog) {
        const level = warehouseStockLevel(product);
        if (level !== "ok") {
          low.push({ key: `w-${product.id}`, product: product.name, where: "Warehouse", quantity: product.warehouse_stock, level });
        }
      }
      for (const h of holdings) {
        const seller = sellers.find((s) => s.id === h.employee_id);
        const level = sellerStockLevel(h.quantity);
        if (seller && h.products && level !== "ok") {
          low.push({ key: `${h.employee_id}-${h.products.id}`, product: h.products.name, where: seller.full_name, quantity: h.quantity, level });
        }
      }
      low.sort((a, b) => a.quantity - b.quantity);

      setLowItems(low);
      setSales(allSales);
      setProducts(catalog);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;

  const today = sales.filter((s) => isToday(s.created_at));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const lastWeek = sales.filter((s) => new Date(s.created_at).getTime() >= weekAgo);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Removed product";
  const sellerName = (id: string) => team.find((t) => t.seller.id === id)?.seller.full_name ?? "Former employee";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        subtitle={new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
      />

      <Stats
        items={[
          { label: "Sales today", value: String(today.length) },
          { label: "Revenue today", value: formatCurrency(today.reduce((s, x) => s + Number(x.total_amount), 0)) },
          { label: "Last 7 days", value: formatCurrency(lastWeek.reduce((s, x) => s + Number(x.total_amount), 0)) },
          {
            label: "Running low",
            value: String(lowItems.length),
            tone: lowItems.length > 0 ? "warning" : "default",
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Team today" action={<Link href="/owner/employees" className={linkClass}>Manage</Link>}>
          {team.length === 0 ? (
            <Empty title="No one on the team yet">
              <Link href="/owner/employees" className={linkClass}>Invite your first seller</Link>
            </Empty>
          ) : (
            team.map(({ seller, salesToday, revenueToday, unitsHeld }) => (
              <Row key={seller.id}>
                <Avatar name={seller.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{seller.full_name}</p>
                  <p className="text-xs text-muted">{unitsHeld} units on hand</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-ink">{formatCurrency(revenueToday)}</p>
                  <p className="text-xs text-muted">
                    {salesToday} {salesToday === 1 ? "sale" : "sales"}
                  </p>
                </div>
              </Row>
            ))
          )}
        </Panel>

        <Panel title="Running low" action={<Link href="/owner/inventory" className={linkClass}>All stock</Link>}>
          {lowItems.length === 0 ? (
            <Empty title="Nothing is running low" />
          ) : (
            lowItems.slice(0, 6).map((item) => (
              <Row key={item.key}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{item.product}</p>
                  <p className="text-xs text-muted">{item.where}</p>
                </div>
                <span className="text-sm font-medium text-ink">{item.quantity}</span>
                <StockBadge level={item.level} />
              </Row>
            ))
          )}
          {lowItems.length > 6 && (
            <Row>
              <Link href="/owner/inventory" className={linkClass}>
                {lowItems.length - 6} more
              </Link>
            </Row>
          )}
        </Panel>
      </div>

      <Panel title="Latest sales" action={<Link href="/owner/sales" className={linkClass}>All sales</Link>}>
        {sales.length === 0 ? (
          <Empty title="No sales yet" />
        ) : (
          sales.slice(0, 5).map((sale) => {
            const [first, ...rest] = sale.sale_items;
            return (
              <Row key={sale.id}>
                <span className="w-[4.75rem] flex-shrink-0 whitespace-nowrap text-sm text-muted">
                  {isToday(sale.created_at)
                    ? formatTime(sale.created_at)
                    : new Date(sale.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {first ? productName(first.product_id) : "No items"}
                    {rest.length > 0 && ` and ${rest.length} more`}
                  </p>
                  <p className="text-xs text-muted">{sellerName(sale.employee_id)}</p>
                </div>
                <span className="text-sm font-medium text-ink">{formatCurrency(Number(sale.total_amount))}</span>
              </Row>
            );
          })
        )}
      </Panel>
    </div>
  );
}
