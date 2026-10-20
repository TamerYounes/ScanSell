"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { classNames } from "@/lib/utils";
import type { DbProfile } from "@/types";

const navItems = [
  { href: "/employee/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/employee/new-sale", label: "New Sale", icon: "cart" },
  { href: "/employee/inventory", label: "Inventory", icon: "box" },
  { href: "/employee/sales-history", label: "History", icon: "clock" },
];

function NavIcon({ type, className = "w-5 h-5" }: { type: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    cart: <><path d="M3 3h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    box: <><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/><path d="m21 8v8l-9 5-9-5V8"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-5"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>;
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single<DbProfile>();
      if (!data) { router.replace("/"); return; }
      if (data.role === "owner") { router.replace("/owner"); return; }
      if (!data.is_active) { await supabase.auth.signOut(); router.replace("/"); return; }
      setProfile(data);
      setLoading(false);
    }
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50"><div className="h-9 w-9 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" /></div>;
  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[230px] flex-col bg-[#303c97] text-white">
        <div className="px-6 py-7 border-b border-white/10">
          <div className="text-2xl font-bold tracking-tight">Stockpile</div>
          <div className="text-sm text-blue-100/80 mt-1">Employee Portal</div>
        </div>
        <nav className="px-3 py-6 space-y-2 flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return <Link key={item.href} href={item.href} className={classNames("relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition", active ? "bg-[#4554c9] text-white shadow-sm" : "text-blue-100 hover:bg-white/10 hover:text-white")}>{active && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r bg-[#8ba4ff]" />}<NavIcon type={item.icon}/>{item.label}</Link>;
          })}
        </nav>
        <button onClick={handleSignOut} className="m-4 flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-blue-100 hover:bg-white/10"><NavIcon type="logout"/>Logout</button>
      </aside>

      <div className="lg:pl-[230px] min-h-screen">
        <header className="sticky top-0 z-30 h-[90px] bg-white border-b border-slate-200 flex items-center justify-between px-5 md:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pathname.includes("new-sale") ? "New Sale" : pathname.includes("inventory") ? "My Inventory" : pathname.includes("sales-history") ? "Sales History" : "My Dashboard"}</h1>
            <p className="text-sm text-slate-500 mt-1">{pathname.includes("new-sale") ? "Create a new sales transaction" : `Welcome back, ${profile.full_name || "Employee"}!`}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden sm:grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Notifications"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></button>
            <button onClick={handleSignOut} className="grid h-10 w-10 place-items-center rounded-full bg-[#3443b5] text-white shadow-sm" title="Sign out"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg></button>
          </div>
        </header>
        <main className="px-4 py-5 md:px-7 md:py-7 pb-24 lg:pb-8">{children}</main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 px-2 safe-area-bottom">
        <div className="grid grid-cols-4">
          {navItems.map((item) => { const active = pathname === item.href; return <Link key={item.href} href={item.href} className={classNames("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", active ? "text-blue-700" : "text-slate-400")}><NavIcon type={item.icon} className="w-5 h-5"/>{item.label}</Link>; })}
        </div>
      </nav>
    </div>
  );
}
