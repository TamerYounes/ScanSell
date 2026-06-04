"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { classNames } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (active: boolean) => (
      <svg
        className={classNames("w-5 h-5", active ? "text-indigo-600" : "text-slate-400")}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    href: "/new-sale",
    label: "New Sale",
    icon: (active: boolean) => (
      <svg
        className={classNames("w-5 h-5", active ? "text-indigo-600" : "text-slate-400")}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
    highlight: true,
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: (active: boolean) => (
      <svg
        className={classNames("w-5 h-5", active ? "text-indigo-600" : "text-slate-400")}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    href: "/sales-history",
    label: "History",
    icon: (active: boolean) => (
      <svg
        className={classNames("w-5 h-5", active ? "text-indigo-600" : "text-slate-400")}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-center">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors",
                item.highlight &&
                  "relative -top-4 bg-indigo-600 rounded-2xl mx-2 py-3 shadow-lg shadow-indigo-200",
                !item.highlight && active ? "text-indigo-600" : "text-slate-400"
              )}
            >
              <span className={item.highlight ? "text-white" : ""}>
                {item.highlight ? (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                ) : (
                  item.icon(active)
                )}
              </span>
              <span
                className={classNames(
                  "text-[10px] font-medium",
                  item.highlight ? "text-white" : active ? "text-indigo-600" : "text-slate-400"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
