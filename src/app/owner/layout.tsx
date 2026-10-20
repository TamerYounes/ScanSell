import { AppShell, type NavItem } from "@/components/layout/AppShell";

const nav: NavItem[] = [
  { href: "/owner/dashboard", label: "Overview", icon: "home" },
  { href: "/owner/products", label: "Products", icon: "products" },
  { href: "/owner/inventory", label: "Stock", icon: "stock" },
  { href: "/owner/employees", label: "Team", icon: "team" },
  { href: "/owner/sales", label: "Sales", icon: "sales" },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="owner" nav={nav}>
      {children}
    </AppShell>
  );
}
