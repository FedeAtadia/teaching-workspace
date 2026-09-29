import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** "← Back to …" as a small pill, used above page titles. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1 rounded-full bg-muted py-1 pr-3.5 pl-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
