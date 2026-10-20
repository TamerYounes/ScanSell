import type { ReactNode } from "react";

export function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-pine" />
    </div>
  );
}

/** What to show when a list is empty: what's missing, and what to do about it. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          : "rounded border border-pine/20 bg-pine-light px-3 py-2 text-sm text-pine-dark"
      }
    >
      {children}
    </div>
  );
}
