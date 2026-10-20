import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";
import type { StockLevel } from "@/lib/stock";

type Variant = "neutral" | "warning" | "danger" | "accent";

const variants: Record<Variant, string> = {
  neutral: "bg-wash text-muted",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  accent: "bg-pine-light text-pine-dark",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "Low" / "Out" marker. Nothing for normal stock, so only problems stand out. */
export function StockBadge({ level }: { level: StockLevel }) {
  if (level === "out") return <Badge variant="danger">Out</Badge>;
  if (level === "low") return <Badge variant="warning">Low</Badge>;
  return null;
}
