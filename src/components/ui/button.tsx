import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-border bg-surface/80 text-foreground hover:border-primary/60 hover:bg-accent",
        secondary: "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline",
        amber: "border-warning/60 bg-warning/15 text-warning hover:bg-warning/25",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-2.5",
        lg: "h-10 px-5",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);