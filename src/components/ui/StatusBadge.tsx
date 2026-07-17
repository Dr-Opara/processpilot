import { clsx } from "clsx";

export function StatusBadge({
  status = "neutral",
  className,
  children,
}: {
  status?: "success" | "warning" | "danger" | "neutral";
  className?: string;
  children: React.ReactNode;
}) {
  const map = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-paper text-muted",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        map[status],
        className,
      )}
    >
      {children}
    </span>
  );
}
