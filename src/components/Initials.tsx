import { cn } from "cn";

/** A student's initials in a tinted circle (rows) or rounded square (a page's header). Decorative: the name is always next to it. */
export function Initials({
  firstName,
  lastName,
  shape = "circle",
  className,
}: {
  firstName: string;
  lastName: string;
  shape?: "circle" | "square";
  className?: string;
}) {
  const letters = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-highlight-soft font-heading font-bold text-highlight",
        shape === "circle" ? "size-8 rounded-full text-xs" : "size-16 rounded-2xl text-2xl",
        className,
      )}
    >
      {letters}
    </span>
  );
}
