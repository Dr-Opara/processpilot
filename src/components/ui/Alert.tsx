import { clsx } from "clsx";

export function Alert({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={clsx("rounded-2xl border border-border bg-[#fcfbf8] p-4", className)}
      role="status"
    >
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}
