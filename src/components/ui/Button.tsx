import React from "react";
import { clsx } from "clsx";

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  const variants = {
    primary: "bg-ink text-surface hover:bg-cobalt",
    secondary: "border border-border bg-surface text-ink hover:bg-paper",
    quiet: "bg-transparent text-ink hover:bg-hover-surface",
  };

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
