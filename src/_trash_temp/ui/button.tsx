"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // baza (jedna wartość lub tablica) – spójny dark/glass jak w Input/Dialog
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/30",
        destructive: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-300",
        outline: "border border-white/10 bg-transparent hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30",
        secondary: "bg-black/30 text-white hover:bg-black/40 focus-visible:ring-2 focus-visible:ring-white/30",
        ghost: "bg-transparent hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30",
        link: "bg-transparent text-blue-400 underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          "transition-colors disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
export default Button;
