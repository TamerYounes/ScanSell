import { Card } from "./Card";
import { classNames } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg?: string;
  sub?: string;
}

export function StatCard({ label, value, icon, iconBg = "bg-indigo-100", sub }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div
          className={classNames(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            iconBg
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
