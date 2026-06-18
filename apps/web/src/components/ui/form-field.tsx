import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, hint, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-label font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
