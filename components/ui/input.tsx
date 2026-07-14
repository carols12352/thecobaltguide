import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm shadow-sm transition-[border-color,box-shadow] placeholder:text-zinc-400 hover:border-zinc-400 focus-visible:border-cobalt-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
