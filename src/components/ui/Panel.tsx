import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";

interface PanelProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Put rows directly inside; they get dividers between them. */
  children: ReactNode;
}

/** A bordered section. Lists go inside one panel as rows, not a card each. */
export function Panel({ title, description, action, className, children }: PanelProps) {
  return (
    <section className={classNames("rounded-lg border border-line bg-white", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

/** A plain row inside a Panel. */
export function Row({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const classes = classNames("flex items-center gap-3 px-4 py-3", className);

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classNames(classes, "w-full text-left hover:bg-paper")}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
