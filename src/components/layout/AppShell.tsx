"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { classNames } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Loading } from "@/components/ui/States";
import type { DbProfile, UserRole } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
      <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 text-pine">
        <rect x="2" y="11" width="7" height="7" rx="1" fill="currentColor" />
        <rect x="11" y="11" width="7" height="7" rx="1" fill="currentColor" />
        <rect x="6.5" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.55" />
      </svg>
      Stockpile
    </span>
  );
}

/**
 * Layout for both roles: a slim sidebar on desktop, a top bar and bottom tabs
 * on phones. Loads the signed-in profile and sends people to the right place
 * if they're the wrong role or their account is off.
 */
export function AppShell({
  role,
  nav,
  children,
}: {
  role: UserRole;
  nav: NavItem[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<DbProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (!data) {
        router.replace("/");
        return;
      }
      if (!data.is_active) {
        await supabase.auth.signOut();
        router.replace("/?inactive=1");
        return;
      }
      if (data.role !== role) {
        router.replace(data.role === "owner" ? "/owner/dashboard" : "/employee/dashboard");
        return;
      }

      setProfile(data);
    }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!profile) return <Loading />;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const name = profile.full_name || (role === "owner" ? "Owner" : "Employee");

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-white lg:flex">
        <div className="px-5 py-5">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "flex items-center gap-3 rounded px-3 py-2 text-sm",
                isActive(item.href)
                  ? "bg-pine-light font-medium text-pine-dark"
                  : "text-muted hover:bg-paper hover:text-ink",
              )}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="text-xs text-muted">{role === "owner" ? "Owner" : "Employee"}</p>
            </div>
          </div>
          <button onClick={signOut} className="mt-3 text-sm text-muted hover:text-ink">
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Wordmark />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{name.split(" ")[0]}</span>
          <button onClick={signOut} className="text-sm font-medium text-ink">
            Sign out
          </button>
        </div>
      </header>

      <main className="px-4 pb-28 pt-5 lg:ml-56 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Phone tabs */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px]",
                isActive(item.href) ? "font-medium text-pine" : "text-faint",
              )}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
