"use client";

import { useState } from "react";
import { formatCurrency, formatTime } from "@/lib/utils";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/ui/Icon";
import { classNames } from "@/lib/utils";
import type { DbSale, DbSaleItem } from "@/types";

export type SaleWithItems = DbSale & { sale_items: DbSaleItem[] };

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Sales grouped by day. Tap a sale to see what was in it. Pass sellerNames to
 * show who made each sale (the owner's view).
 */
export function SalesList({
  sales,
  productNames,
  sellerNames,
}: {
  sales: SaleWithItems[];
  productNames: Map<string, string>;
  sellerNames?: Map<string, string>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const days: { label: string; sales: SaleWithItems[] }[] = [];
  for (const sale of sales) {
    const label = dayLabel(sale.created_at);
    const last = days[days.length - 1];
    if (last?.label === label) last.sales.push(sale);
    else days.push({ label, sales: [sale] });
  }

  const name = (id: string) => productNames.get(id) ?? "Removed product";

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <Panel
          key={day.label}
          title={day.label}
          action={
            <span className="text-sm font-medium text-ink">
              {formatCurrency(day.sales.reduce((sum, s) => sum + Number(s.total_amount), 0))}
            </span>
          }
        >
          {day.sales.map((sale) => {
            const isOpen = open === sale.id;
            const [first, ...rest] = sale.sale_items;
            const summary = first
              ? `${name(first.product_id)}${rest.length ? ` and ${rest.length} more` : ""}`
              : "No items";
            const seller = sellerNames?.get(sale.employee_id);

            return (
              <div key={sale.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : sale.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper"
                >
                  <span className="w-[4.75rem] flex-shrink-0 whitespace-nowrap text-sm text-muted">{formatTime(sale.created_at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{summary}</span>
                    <span className="block text-xs text-muted">
                      {seller ? `${seller}, ${sale.payment_method}` : sale.payment_method}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {formatCurrency(Number(sale.total_amount))}
                  </span>
                  <Icon
                    name="chevron"
                    className={classNames("h-4 w-4 flex-shrink-0 text-faint transition-transform", isOpen && "rotate-180")}
                  />
                </button>

                {isOpen && (
                  <ul className="border-t border-line bg-paper px-4 py-2">
                    {sale.sale_items.map((item) => (
                      <li key={item.id} className="flex items-baseline gap-3 py-1 text-sm">
                        <span className="w-8 flex-shrink-0 text-muted">{item.quantity}×</span>
                        <span className="min-w-0 flex-1 truncate text-ink">{name(item.product_id)}</span>
                        <span className="text-muted">{formatCurrency(Number(item.subtotal))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Panel>
      ))}
    </div>
  );
}
