"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { classNames } from "@/lib/utils";
import type { DbProfile } from "@/types";

const navItems = [
  {
    href: "/employee/dashboard",
    label: "Home",
    icon: (active: boolean) => (
      <svg className={classNames("w-5 h-5", active ? "text-indigo-600" : "text-slate-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/employee/new-sale",
    label: "New Sale",
    highlight: true,
    icon: () => (
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/employee/inventory",
    label: "Inventory",
    icon: (active: boolean) => (
      <svg className={classNames("w-5 h-5", active ? "text-indigo-600" : "text-slate-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/employee/sales-history",
    label: "History",
    icon: (active: boolean) => (
      <svg className={classNames("w-5 h-5", active ? "text-indigo-600" : "text-slate-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
];

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

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single<import("@/types").DbProfile>();

      if (!data) { router.replace("/"); return; }
      if (data.role === "owner") { router.replace("/owner"); return; }
      if (!data.is_active) {
        await supabase.auth.signOut();
        router.replace("/");
        return;
      }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div>
          <p className="text-xs text-slate-400 font-medium">Hey,</p>
          <p className="text-base font-bold text-slate-800">{profile.full_name}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 px-4 pb-28 pt-2">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100">
        <div className="max-w-lg mx-auto flex items-center">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={classNames(
                  "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                  item.highlight && "relative -top-4 bg-indigo-600 rounded-2xl mx-2 py-3 shadow-lg shadow-indigo-200"
                )}
              >
                <span>{item.icon(active)}</span>
                <span className={classNames(
                  "text-[10px] font-medium",
                  item.highlight ? "text-white" : active ? "text-indigo-600" : "text-slate-400"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
