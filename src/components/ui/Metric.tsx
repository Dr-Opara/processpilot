import { clsx } from "clsx";

export function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={clsx("rounded-2xl border border-border bg-surface p-6 shadow-soft", className)}>
      <p className="text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-muted">{label}</p>
    </div>
  );
}
