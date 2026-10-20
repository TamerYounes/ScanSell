"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { classNames, formatCurrency } from "@/lib/utils";
import { sellerStockLevel } from "@/lib/stock";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, Row } from "@/components/ui/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StockBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Empty, Loading, Notice } from "@/components/ui/States";
import type { DbProfile, DbSale, ProductWithStock } from "@/types";

const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";

function daysLeft(expiresAt: string) {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  return days <= 1 ? "Expires today" : `Expires in ${days} days`;
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
        .map((r) => ({ ...r.products!, stockQuantity: r.quantity }))

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

  if (loading) return <Loading />;

  const active = employees.filter((e) => e.profile.is_active);
  const inactive = employees.filter((e) => !e.profile.is_active);

  function renderEmployee({ profile, inventory, recentSales, totalRevenue }: EmployeeDetail) {
    const unitsHeld = inventory.reduce((sum, p) => sum + p.stockQuantity, 0);
    const isOpen = openId === profile.id;
    const isBusy = busyId === profile.id;
    const name = profile.full_name || "New employee";

    return (
      <div key={profile.id}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => {
            setOpenId(isOpen ? null : profile.id);
            setConfirmDeactivate(null);
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper"
        >
          <Avatar name={name} muted={!profile.is_active} />
          <span className="min-w-0 flex-1">
            <span className={classNames("block truncate text-sm font-medium", profile.is_active ? "text-ink" : "text-muted")}>
              {name}
            </span>
            <span className="block text-xs text-muted">
              {profile.is_active ? `${unitsHeld} units on hand` : "No access"}
            </span>
          </span>
          <span className="text-right">
            <span className="block text-sm text-ink">{formatCurrency(totalRevenue)}</span>
            <span className="block text-xs text-muted">all-time sales</span>
          </span>
          <Icon name="chevron" className={classNames("h-4 w-4 text-faint transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="border-t border-line bg-paper px-4 py-3">
            {profile.is_active && (
              <>
                <p className="mb-1 text-xs text-muted">Carrying</p>
                {inventory.length === 0 ? (
                  <p className="text-sm text-muted">Nothing assigned.</p>
                ) : (
                  <ul className="mb-3">
                    {inventory.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 py-0.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                        <StockBadge level={sellerStockLevel(p.stockQuantity)} />
                        <span className="w-6 text-right text-ink">{p.stockQuantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {recentSales.length > 0 && (
              <p className="mb-3 text-xs text-muted">
                Last sale{" "}
                {new Date(recentSales[0].created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })},{" "}
                {formatCurrency(Number(recentSales[0].total_amount))}
              </p>
            )}

            {!profile.is_active ? (
              <Button size="sm" onClick={() => setActive(profile, true)} disabled={isBusy}>
                {isBusy ? "Giving access…" : "Give access"}
              </Button>
            ) : confirmDeactivate === profile.id ? (
              <div className="space-y-2">
                <p className="text-sm text-ink">
                  {name} will lose access
                  {unitsHeld > 0 && `, and their ${unitsHeld} ${unitsHeld === 1 ? "unit goes" : "units go"} back to the warehouse`}
                  . Their past sales stay.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" onClick={() => setActive(profile, false)} disabled={isBusy}>
                    {isBusy ? "Deactivating…" : "Deactivate"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeactivate(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirmDeactivate(profile.id)}>
                Deactivate
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        subtitle={`${active.length} active${inactive.length > 0 ? `, ${inactive.length} without access` : ""}`}
        action={
          <Button onClick={handleInvite} disabled={inviting}>
            {inviting ? "Creating…" : "Invite"}
          </Button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      {newInvite && (
        <div className="rounded-lg border border-pine/30 bg-white p-4">
          <p className="text-sm font-semibold text-ink">Invite link ready</p>
          <p className="mt-1 text-sm text-muted">
            Send this to the new seller. It works once. {daysLeft(newInvite.expires_at)}.
            {demoEnabled && " Joining is off in the demo, so it won't create an account."}
          </p>
          <p className="mt-3 select-all break-all rounded border border-line bg-paper px-3 py-2 text-sm text-ink">
            {inviteLink(newInvite.code)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => shareLink(newInvite.code)}>
              Share
            </Button>
            <Button size="sm" variant="secondary" onClick={() => copyLink(newInvite.code)}>
              {copied === newInvite.code ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewInvite(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <Panel title="Sellers">
        {active.length === 0 ? (
          <Empty title="No sellers yet">Tap Invite to get a sign-up link to send someone.</Empty>
        ) : (
          active.map(renderEmployee)
        )}
      </Panel>

      {invites.length > 0 && (
        <Panel title="Open invite links" description="Each works once.">
          {invites.map((invite) => (
            <Row key={invite.code}>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{invite.code}</p>
                <p className="text-xs text-muted">{daysLeft(invite.expires_at)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copyLink(invite.code)}>
                {copied === invite.code ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => revokeInvite(invite.code)}>
                Revoke
              </Button>
            </Row>
          ))}
        </Panel>
      )}

      {inactive.length > 0 && <Panel title="Without access">{inactive.map(renderEmployee)}</Panel>}
    </div>
  );
}
