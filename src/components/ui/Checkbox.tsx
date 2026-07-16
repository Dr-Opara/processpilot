import React from "react";
import { clsx } from "clsx";

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={clsx(
        "h-4 w-4 rounded border-border text-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt",
        className,
      )}
      {...props}
    />
  );
});
