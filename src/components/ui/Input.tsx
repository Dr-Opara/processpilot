import { clsx } from "clsx";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20",
        className,
      )}
      {...props}
    />
  );
}
