"use client";

import * as React from "react";
import { cn } from "@/lib/utils"; // jeśli nie masz tego pliku, zobacz niżej

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      // wygląd: dark UI (Warehouse-style)
      "flex h-9 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white shadow-sm placeholder:text-neutral-400",
      "transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export default Input;
