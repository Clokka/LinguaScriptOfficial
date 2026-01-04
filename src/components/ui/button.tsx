import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-[0_0_40px_hsl(252_100%_69%/0.3)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent hover:bg-secondary hover:text-secondary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glass:
          "rounded-xl border bg-[hsl(230_25%_12%/0.7)] border-[hsl(250_30%_30%/0.3)] backdrop-blur-[20px] text-foreground hover:bg-muted/50",
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/90 shadow-md hover:shadow-[0_0_30px_hsl(32_100%_55%/0.4)]",
        success:
          "bg-success text-success-foreground hover:bg-success/90 shadow-md hover:shadow-[0_0_20px_hsl(142_70%_45%/0.3)]",
        hero:
          "bg-gradient-to-r from-[hsl(252_100%_69%)] to-[hsl(280_100%_60%)] text-primary-foreground font-semibold shadow-lg hover:shadow-[0_0_40px_hsl(252_100%_69%/0.3)] hover:scale-105 active:scale-100",
        subtle:
          "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
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
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
