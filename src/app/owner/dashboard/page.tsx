"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbProfile, DbSale, ProductWithStock } from "@/types";

interface EmployeeSummary {
  employee: DbProfile;
  todayCount: number;
  todayRevenue: number;
  totalRevenue: number;
  stockCount: number;
  lowCount: number;
}

interface LowStockAlert {
  product: ProductWithStock;
  employeeName: string;
  employeeColor: string;
  employeeInitials: string;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function OwnerDashboard() {
  const supabase = createClient();

  const [employees, setEmployees]         = useState<DbProfile[]>([]);
  const [allSales, setAllSales]           = useState<DbSale[]>([]);
  const [summaries, setSummaries]         = useState<EmployeeSummary[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    async function load() {
      // All employees
      const { data: empRows } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "employee")
        .eq("is_active", true)
        .order("full_name");

      const emps: DbProfile[] = empRows ?? [];

      // All sales
      const { data: saleRows } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      const sales: DbSale[] = saleRows ?? [];

      // All employee inventory joined with products
      const { data: invRows } = await supabase
        .from("employee_inventory")
        .select("employee_id, quantity, products(*)");

      // Build per-employee summaries
      const built: EmployeeSummary[] = emps.map((emp) => {
        const empSales    = sales.filter((s) => s.employee_id === emp.id);
        const todaySales  = empSales.filter((s) => isToday(s.created_at));
        const empInv      = (invRows ?? []).filter((r: any) => r.employee_id === emp.id);
        const lowCount    = empInv.filter(
          (r: any) => r.quantity <= r.products.low_stock_limit
        ).length;

        return {
          employee:     emp,
          todayCount:   todaySales.length,
          todayRevenue: todaySales.reduce((s, sale) => s + Number(sale.total_amount), 0),
          totalRevenue: empSales.reduce((s, sale) => s + Number(sale.total_amount), 0),
          stockCount:   empInv.length,
          lowCount,
        };
      });

      // Build low-stock alerts across all employees
      const alerts: LowStockAlert[] = [];
      for (const emp of emps) {
        const empInv = (invRows ?? []).filter((r: any) => r.employee_id === emp.id);
        for (const row of empInv as any[]) {
          if (row.quantity <= row.products.low_stock_limit) {
            alerts.push({
              product: { ...row.products, stockQuantity: row.quantity },
              employeeName:     emp.full_name,
              employeeColor:    emp.avatar_color,
              employeeInitials: getInitials(emp.full_name),
            });
          }
        }
      }

      setEmployees(emps);
      setAllSales(sales);
      setSummaries(built);
      setLowStockAlerts(alerts);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todaysSales   = allSales.filter((s) => isToday(s.created_at));
  const todaysRevenue = todaysSales.reduce((s, sale) => s + Number(sale.total_amount), 0);
  const totalRevenue  = allSales.reduce((s, sale) => s + Number(sale.total_amount), 0);

  const dateLabel = new Date().toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-xs text-slate-400 font-medium">{dateLabel}</p>
        <h1 className="text-xl font-bold text-slate-800 mt-0.5">Business Overview</h1>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Today's Revenue"
          value={formatCurrency(todaysRevenue)}
          iconBg="bg-indigo-100"
          icon={
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Sales Today"
          value={String(todaysSales.length)}
          iconBg="bg-emerald-100"
          sub={`across ${employees.length} reps`}
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        <StatCard
          label="All-Time Revenue"
          value={formatCurrency(totalRevenue)}
          iconBg="bg-violet-100"
          icon={
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          label="Low Stock Alerts"
          value={String(lowStockAlerts.length)}
          iconBg={lowStockAlerts.length > 0 ? "bg-amber-100" : "bg-emerald-100"}
          icon={
            <svg
              className={`w-5 h-5 ${lowStockAlerts.length > 0 ? "text-amber-600" : "text-emerald-600"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      {/* Employee performance */}
      <PageHeader
        title="Today by Employee"
        action={
          <Link href="/owner/employees" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            Manage →
          </Link>
        }
      />
      <div className="space-y-2 mb-6">
        {summaries.map(({ employee, todayCount, todayRevenue, lowCount, stockCount }) => (
          <Card key={employee.id} className="p-3.5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${employee.avatar_color} rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {getInitials(employee.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{employee.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-slate-500">{stockCount} products assigned</span>
                  {lowCount > 0 && <Badge variant="warning">{lowCount} low stock</Badge>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-slate-800">{formatCurrency(todayRevenue)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {todayCount} sale{todayCount !== 1 ? "s" : ""} today
                </p>
              </div>
            </div>
          </Card>
        ))}

        {employees.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-slate-400 text-sm">No employees yet.</p>
            <Link href="/owner/employees" className="text-xs text-indigo-600 font-semibold mt-1 inline-block">
              Add your first employee →
            </Link>
          </Card>
        )}
      </div>

      {/* Low stock alerts */}
      {lowStockAlerts.length > 0 && (
        <>
          <PageHeader
            title="Low Stock Alerts"
            subtitle="Across all employees"
            action={
              <Link href="/owner/inventory" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View all →
              </Link>
            }
          />
          <div className="space-y-2">
            {lowStockAlerts.slice(0, 5).map((alert, idx) => (
              <Card key={idx} className="p-3.5 flex items-center gap-3">
                <div className={`w-8 h-8 ${alert.employeeColor} rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {alert.employeeInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{alert.product.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{alert.employeeName}</p>
                </div>
                <Badge variant={alert.product.stockQuantity === 0 ? "danger" : "warning"}>
                  {alert.product.stockQuantity === 0 ? "Out" : `${alert.product.stockQuantity} left`}
                </Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
