import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-pine text-white hover:bg-pine-dark",
  secondary: "border border-line bg-white text-ink hover:bg-wash",
  ghost: "text-muted hover:bg-wash hover:text-ink",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

/** Class names for a link styled as a button. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return classNames(
    "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, classNames(fullWidth && "w-full", className))} {...props}>
      {children}
    </button>
  );
}
