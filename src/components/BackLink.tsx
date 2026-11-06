import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** The page this one belongs to, as a quiet breadcrumb above the title: "‹ Cursos". */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
