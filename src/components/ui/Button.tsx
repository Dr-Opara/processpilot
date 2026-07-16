import React from "react";
import { clsx } from "clsx";

const variants = {
  primary: "bg-ink text-surface hover:bg-cobalt",
  secondary: "border border-border bg-surface text-ink hover:bg-paper",
  quiet: "bg-transparent text-ink hover:bg-hover-surface",
  // For use on dark section backgrounds (e.g. CtaBand). Kept as distinct
  // variants rather than className overrides: conflicting Tailwind utility
  // classes (e.g. bg-ink vs bg-surface) don't reliably resolve in className
  // string order, so overriding a variant's colors via className can
  // silently produce invisible text.
  onDark: "bg-surface text-ink hover:bg-paper",
  outlineOnDark:
    "border border-surface/30 bg-transparent text-surface hover:bg-surface/10",
};

type Variant = keyof typeof variants;

const buttonClassName = (variant: Variant, className?: string) =>
  clsx(
    "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt",
    variants[variant],
    className,
  );

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  href?: undefined;
};

type AnchorButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  href: string;
};

export function Button({
  children,
  variant = "primary",
  className,
  href,
  ...props
}: ButtonProps | AnchorButtonProps) {
  if (href) {
    return (
      <a
        href={href}
        className={buttonClassName(variant, className)}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      className={buttonClassName(variant, className)}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
