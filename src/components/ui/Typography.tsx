import { clsx } from "clsx";

export function Heading({
  as: Component = "h2",
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3" | "h4";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Component className={clsx("font-semibold tracking-tight text-ink", className)}>
      {children}
    </Component>
  );
}

export function Text({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={clsx("text-base leading-7 text-ink", className)}>{children}</p>;
}

export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={clsx("text-xs font-semibold uppercase tracking-[0.3em] text-cobalt", className)}>
      {children}
    </p>
  );
}

export function Label({
  className,
  htmlFor,
  children,
}: {
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={clsx("text-sm font-medium text-ink", className)} htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function CodeText({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <code className={clsx("font-mono text-sm text-cobalt", className)}>{children}</code>;
}
