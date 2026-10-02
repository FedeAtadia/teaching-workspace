"use client";

import { ClipboardList, Flag, GraduationCap, Layers, Sheet, Target, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, LucideIcon> = {
  students: Users,
  standards: Target,
  units: Layers,
  tasks: ClipboardList,
  grades: Sheet,
  termGrades: GraduationCap,
  closing: Flag,
};

/** The tabs under a class's header; each tab is its own route. */
export function ClassTabs({ tabs }: { tabs: { href: string; label: string; icon: string }[] }) {
  const pathname = usePathname();
  // The first tab is the class root, which every other tab's path starts with.
  const active = [...tabs].reverse().find((t) => pathname.startsWith(t.href))?.href;
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const Icon = ICONS[t.icon];
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-muted px-4 text-sm font-bold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
