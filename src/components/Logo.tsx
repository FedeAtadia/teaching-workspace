import { cn } from "cn";

/** The STACK mark: three stacked bars. Decorative; the name next to it is the text. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 26" className={cn("size-7 shrink-0", className)} aria-hidden>
      <rect x="3" y="15" width="20" height="7" rx="2" fill="#157cc5" />
      <rect x="6" y="9" width="16" height="6" rx="2" fill="#0496ff" />
      <rect x="4" y="4" width="12" height="5" rx="2" fill="#ff0054" />
    </svg>
  );
}

/** The mark and the name, in League Spartan. */
export function Logo({ name, className, size = "md" }: { name: string; className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className={size === "lg" ? "size-10" : undefined} />
      <span
        className={cn(
          "font-heading leading-none font-bold tracking-[0.12em]",
          size === "lg" ? "text-4xl" : "text-2xl",
        )}
      >
        {name}
      </span>
    </span>
  );
}
