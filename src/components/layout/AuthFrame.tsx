import type { ReactNode } from "react";

/** Frame for the signed-out pages: name and one line about the app, then the form. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <p className="flex items-center gap-2 text-lg font-semibold text-ink">
            <svg aria-hidden viewBox="0 0 20 20" className="h-6 w-6 text-pine">
              <rect x="2" y="11" width="7" height="7" rx="1" fill="currentColor" />
              <rect x="11" y="11" width="7" height="7" rx="1" fill="currentColor" />
              <rect x="6.5" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.55" />
            </svg>
            Stockpile
          </p>
          <p className="mt-2 text-sm text-muted">
            Track the stock each seller carries and every sale they make, from your phone.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
