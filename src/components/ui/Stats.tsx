import { classNames } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  tone?: "default" | "warning";
}

/** A row of key numbers in one strip, instead of a card per number. */
export function Stats({ items }: { items: Stat[] }) {
  return (
    <dl
      className={classNames(
        "grid rounded-lg border border-line bg-white",
        items.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
      )}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          className={classNames(
            "px-4 py-3",
            i > 0 && "border-l border-line",
            items.length === 4 && i === 2 && "border-l-0 sm:border-l",
            items.length === 4 && i >= 2 && "border-t border-line sm:border-t-0",
          )}
        >
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd
            className={classNames(
              "mt-1 text-lg font-semibold",
              item.tone === "warning" ? "text-amber-700" : "text-ink",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
