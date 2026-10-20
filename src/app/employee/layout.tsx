import { AppShell, type NavItem } from "@/components/layout/AppShell";

const nav: NavItem[] = [
  { href: "/employee/dashboard", label: "Today", icon: "home" },
  { href: "/employee/new-sale", label: "New sale", icon: "sale" },
  { href: "/employee/inventory", label: "My stock", icon: "stock" },
  { href: "/employee/sales-history", label: "History", icon: "history" },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="employee" nav={nav}>
      {children}
    </AppShell>
  );
}
