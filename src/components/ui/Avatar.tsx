import { classNames } from "@/lib/utils";

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

/** Initials in a small square. Same colour for everyone, so it never fights the data. */
export function Avatar({
  name,
  size = "md",
  muted,
}: {
  name: string;
  size?: "sm" | "md";
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={classNames(
        "inline-flex flex-shrink-0 items-center justify-center rounded font-semibold",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs",
        muted ? "bg-wash text-faint" : "bg-pine-light text-pine-dark",
      )}
    >
      {initials(name)}
    </span>
  );
}
