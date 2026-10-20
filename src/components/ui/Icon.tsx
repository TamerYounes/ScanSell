const paths = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  sale: (
    <>
      <path d="M4 5h2l2 10h10l2-7H7.2" />
      <circle cx="9.5" cy="19" r="1.2" />
      <circle cx="16.5" cy="19" r="1.2" />
    </>
  ),
  stock: (
    <>
      <path d="M4 8h16v12H4z" />
      <path d="M8 4h8v4H8z" />
      <path d="M10 12h4" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7" />
      <path d="M4 4v4.7h4.7M12 8v4.5l3 1.8" />
    </>
  ),
  products: <path d="M5 5v14M8 5v14M11.5 5v14M14 5v14M17.5 5v14M19.5 5v14" />,
  team: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17 14.6a5.5 5.5 0 0 1 3.5 5.4" />
    </>
  ),
  sales: <path d="M4 20V10M10 20V4M16 20v-7M20 20H3" />,
  scan: (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
