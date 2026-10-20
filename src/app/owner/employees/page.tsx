"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import type { DbProfile, DbSale, ProductWithStock } from "@/types";

const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

function daysLeft(expiresAt: string) {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  return days <= 1 ? "expires today" : `expires in ${days} days`;
}

interface EmployeeDetail {
  profile: DbProfile;
  inventory: ProductWithStock[];
  recentSales: DbSale[];
  totalRevenue: number;
}

interface OpenInvite {
  code: string;
  expires_at: string;
}

export default function OwnerEmployeesPage() {
  const supabase = createClient();

  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [invites, setInvites] = useState<OpenInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newInvite, setNewInvite] = useState<OpenInvite | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [{ data: empRows }, { data: invRows }, { data: saleRows }, { data: inviteRows }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("role", "employee").order("full_name"),
        supabase.from("employee_inventory").select("employee_id, quantity, products(*)"),
        supabase.from("sales").select("*").order("created_at", { ascending: false }),
        supabase
          .from("invites")
          .select("code, expires_at")
          .is("used_by", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false }),
      ]);

    const details: EmployeeDetail[] = (empRows ?? []).map((emp) => {
      const empInv = (invRows ?? [])
        .filter((r) => r.employee_id === emp.id && r.products)
        .map((r) => ({ ...r.products!, stockQuantity: r.quantity }));

      const empSales = (saleRows ?? []).filter((s) => s.employee_id === emp.id);

      return {
        profile: emp,
        inventory: empInv,
        recentSales: empSales.slice(0, 4),
        totalRevenue: empSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0),
      };
    });

    setEmployees(details);
    setInvites(inviteRows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function inviteLink(code: string) {
    return `${window.location.origin}/join/${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(code);
      setTimeout(() => setCopied((current) => (current === code ? null : current)), 2000);
    } catch {
      setError("Couldn't copy. Press and hold the link to copy it instead.");
    }
  }

  async function shareLink(code: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join Stockpile", url: inviteLink(code) });
      } catch {
        // The share sheet was closed.
      }
    } else {
      copyLink(code);
    }
  }

  async function handleInvite() {
    setInviting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("create_invite");

    setInviting(false);

    if (rpcError || !data?.[0]) {
      setError(
        rpcError?.message.includes("TOO_MANY_OPEN_INVITES")
          ? "You have 20 open invite links. Revoke some before making more."
          : "Couldn't create an invite link. Try again.",
      );
      return;
    }

    setNewInvite(data[0]);
    setInvites((prev) => [data[0], ...prev]);
  }

  async function revokeInvite(code: string) {
    const { error: deleteError } = await supabase.from("invites").delete().eq("code", code);

    if (deleteError) {
      setError("Couldn't revoke that link. Try again.");
      return;
    }

    setInvites((prev) => prev.filter((i) => i.code !== code));
    if (newInvite?.code === code) setNewInvite(null);
  }

  async function setActive(employee: DbProfile, active: boolean) {
    setBusyId(employee.id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("set_employee_active", {
      p_employee_id: employee.id,
      p_active: active,
    });

    setBusyId(null);
    setConfirmDeactivate(null);

    if (rpcError) {
      setError(`Couldn't update ${employee.full_name || "that employee"}. Try again.`);
      return;
    }

    // Deactivating moves stock back to the warehouse, so reload everything.
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const active = employees.filter((e) => e.profile.is_active);
  const inactive = employees.filter((e) => !e.profile.is_active);

  function renderEmployee({ profile, inventory, recentSales, totalRevenue }: EmployeeDetail) {
    const lowStock = inventory.filter((p) => p.stockQuantity <= p.low_stock_limit);
    const unitsHeld = inventory.reduce((sum, p) => sum + p.stockQuantity, 0);
    const isOpen = openId === profile.id;
    const isBusy = busyId === profile.id;
    const name = profile.full_name || "New employee";

    return (
      <Card key={profile.id} className="overflow-hidden">
        <button
          onClick={() => {
            setOpenId(isOpen ? null : profile.id);
            setConfirmDeactivate(null);
          }}
          className="w-full p-4 flex items-center gap-3 text-left"
        >
          <div
            className={`w-11 h-11 ${profile.is_active ? profile.avatar_color : "bg-slate-300"} rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0`}
          >
            {getInitials(profile.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${profile.is_active ? "text-slate-800" : "text-slate-500"}`}>
              {name}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {profile.is_active ? (
                <span className="text-xs text-slate-500">
                  {inventory.length} products · {unitsHeld} units held
                </span>
              ) : (
                <span className="text-xs text-slate-500">No access</span>
              )}
              {lowStock.length > 0 && <Badge variant="warning">{lowStock.length} low</Badge>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-slate-800">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-slate-400 mt-0.5">total sales</p>
          </div>
          <svg
            className={`w-4 h-4 text-slate-300 ml-1 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="border-t border-slate-100">
            {profile.is_active && (
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
                            <p className="text-xs font-semibold text-slate-700 truncate">{product.name}</p>
                            <p className="text-xs font-mono text-slate-400">{product.barcode}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-sm font-bold ${isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-emerald-600"}`}
                            >
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
            )}

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
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(sale.created_at).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
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

            <div className="px-4 py-3 border-t border-slate-100">
              {!profile.is_active ? (
                <Button size="sm" onClick={() => setActive(profile, true)} disabled={isBusy}>
                  {isBusy ? "Turning on..." : "Give access"}
                </Button>
              ) : confirmDeactivate === profile.id ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    {name} will lose access
                    {unitsHeld > 0 &&
                      ` and their ${unitsHeld} unit${unitsHeld === 1 ? "" : "s"} go back to the warehouse`}
                    . Their past sales stay.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => setActive(profile, false)} disabled={isBusy}>
                      {isBusy ? "Deactivating..." : "Deactivate"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDeactivate(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmDeactivate(profile.id)}>
                  Deactivate
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${active.length} active${inactive.length > 0 ? ` · ${inactive.length} inactive` : ""}`}
        action={
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {inviting ? "Creating..." : "+ Invite"}
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {newInvite && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-slate-800">Invite link ready</p>
          <p className="mt-1 text-xs text-slate-500">
            Send it to the new employee. It works once and {daysLeft(newInvite.expires_at)}.
            {demoEnabled && " Joining is turned off in the demo, so this link won't create an account."}
          </p>
          <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 select-all">
            {inviteLink(newInvite.code)}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => shareLink(newInvite.code)}>
              Share
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyLink(newInvite.code)}>
              {copied === newInvite.code ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewInvite(null)}>
              Done
            </Button>
          </div>
        </Card>
      )}

      {invites.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Open invite links
          </p>
          <Card className="divide-y divide-slate-100">
            {invites.map((invite) => (
              <div key={invite.code} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-slate-700">{invite.code}</p>
                  <p className="text-xs text-slate-400">{daysLeft(invite.expires_at)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => copyLink(invite.code)}>
                    {copied === invite.code ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => revokeInvite(invite.code)}>
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {employees.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500 text-sm">No employees yet.</p>
          <p className="text-slate-400 text-xs mt-1">
            Tap Invite to get a sign-up link to send to someone.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && <div className="space-y-3">{active.map(renderEmployee)}</div>}

          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Inactive
              </p>
              <div className="space-y-3">{inactive.map(renderEmployee)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
