import { clsx } from "clsx";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
