"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { classNames, formatCurrency, formatTime } from "@/lib/utils";
import { sellerStockLevel } from "@/lib/stock";
import { Stats } from "@/components/ui/Stats";
import { Panel, Row } from "@/components/ui/Panel";
import { StockBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";
import { Empty, Loading } from "@/components/ui/States";
import type { DbSale, ProductWithStock } from "@/types";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const linkClass = "text-sm font-medium text-pine hover:underline underline-offset-2";

export default function EmployeeDashboard() {
  const supabase = createClient();
  const [stock, setStock] = useState<ProductWithStock[]>([]);
  const [sales, setSales] = useState<DbSale[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: held }, { data: saleRows }, { data: me }] = await Promise.all([
        supabase.from("employee_inventory").select("quantity, products(*)").eq("employee_id", user.id),
        supabase.from("sales").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      ]);

      setStock(
        (held ?? [])
          .filter((row) => row.products)
          .map((row) => ({ ...row.products!, stockQuantity: row.quantity })),
      );
      setSales(saleRows ?? []);
      setName(me?.full_name.split(" ")[0] ?? "");
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;

  const now = new Date();
  const today = sales.filter((s) => sameDay(new Date(s.created_at), now));
  const onHand = stock.reduce((sum, p) => sum + p.stockQuantity, 0);
  const low = stock.filter((p) => sellerStockLevel(p.stockQuantity) !== "ok");

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const daySales = sales.filter((s) => sameDay(new Date(s.created_at), day));
    return {
      label: i === 6 ? "Today" : day.toLocaleDateString("en-CA", { weekday: "short" }),
      total: daySales.reduce((sum, s) => sum + Number(s.total_amount), 0),
    };
  });
  const best = Math.max(1, ...week.map((d) => d.total));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-ink">{name ? `Hi, ${name}` : "Today"}</h1>
        <Link href="/employee/new-sale" className={buttonClass("primary", "md", "hidden sm:inline-flex")}>
          <Icon name="scan" className="h-[18px] w-[18px]" />
          New sale
        </Link>
      </div>

      <Link href="/employee/new-sale" className={buttonClass("primary", "lg", "w-full sm:hidden")}>
        <Icon name="scan" />
        New sale
      </Link>

      <Stats
        items={[
          { label: "Sales today", value: String(today.length) },
          { label: "Revenue today", value: formatCurrency(today.reduce((s, x) => s + Number(x.total_amount), 0)) },
          { label: "Units on hand", value: String(onHand) },
          { label: "Running low", value: String(low.length), tone: low.length > 0 ? "warning" : "default" },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Last 7 days">
          <div className="flex h-36 items-end gap-2 px-4 pb-3 pt-4">
            {week.map((day) => (
              <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] text-muted">{day.total > 0 ? `$${Math.round(day.total)}` : ""}</span>
                <div
                  className={classNames("w-full max-w-10 rounded-sm", day.label === "Today" ? "bg-pine" : "bg-pine/40")}
                  style={{ height: `${Math.max(day.total > 0 ? 6 : 2, (day.total / best) * 70)}%` }}
                />
                <span className={classNames("text-[11px]", day.label === "Today" ? "font-medium text-ink" : "text-muted")}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Running low" action={<Link href="/employee/inventory" className={linkClass}>My stock</Link>}>
          {low.length === 0 ? (
            <Empty title="You're well stocked" />
          ) : (
            low.map((p) => (
              <Row key={p.id}>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                <span className="text-sm font-medium text-ink">{p.stockQuantity}</span>
                <StockBadge level={sellerStockLevel(p.stockQuantity)} />
              </Row>
            ))
          )}
        </Panel>
      </div>

      <Panel title="Recent sales" action={<Link href="/employee/sales-history" className={linkClass}>History</Link>}>
        {sales.length === 0 ? (
          <Empty title="No sales yet" />
        ) : (
          sales.slice(0, 4).map((sale) => (
            <Row key={sale.id}>
              <span className="w-24 flex-shrink-0 whitespace-nowrap text-sm text-muted">
                {sameDay(new Date(sale.created_at), now)
                  ? formatTime(sale.created_at)
                  : new Date(sale.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
              </span>
              <span className="flex-1 text-sm text-muted">{sale.payment_method}</span>
              <span className="text-sm font-medium text-ink">{formatCurrency(Number(sale.total_amount))}</span>
            </Row>
          ))
        )}
      </Panel>
    </div>
  );
}
