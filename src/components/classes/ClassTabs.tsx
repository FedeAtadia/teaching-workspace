"use client";

import {
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  Flag,
  GraduationCap,
  Layers,
  Sheet as SheetIcon,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const ICONS: Record<string, LucideIcon> = {
  students: Users,
  standards: Target,
  units: Layers,
  tasks: ClipboardList,
  grades: SheetIcon,
  termGrades: GraduationCap,
  attendance: CalendarCheck,
  closing: Flag,
};

type Tab = { href: string; label: string; icon: string };

/**
 * The sections under a class's header; each is its own route. From a tablet
 * up, a row of pills. NAV-3: on a phone, eight pills would scroll off the
 * screen, so one button shows the current section and opens the list.
 */
export function ClassTabs({ tabs, title }: { tabs: Tab[]; title: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The first tab is the class root, which every other tab's path starts with.
  const active = [...tabs].reverse().find((t) => pathname.startsWith(t.href)) ?? tabs[0];
  const ActiveIcon = ICONS[active.icon];

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="flex h-12 w-full items-center gap-3 rounded-xl bg-card px-4 text-[15px] font-bold ring-1 ring-border md:hidden">
          {ActiveIcon && <ActiveIcon className="size-5 text-highlight" aria-hidden />}
          <span className="flex-1 text-left">{active.label}</span>
          <ChevronDown className="size-5 text-muted-foreground" aria-hidden />
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl px-3 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="px-3 text-lg font-bold">{title}</SheetTitle>
          <nav className="grid gap-1">
            {tabs.map((t) => {
              const Icon = ICONS[t.icon];
              const current = t.href === active.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={() => setOpen(false)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-bold",
                    current ? "bg-highlight-soft text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <nav className="hidden flex-wrap gap-2 md:flex">
        {tabs.map((t) => {
          const Icon = ICONS[t.icon];
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.href === active.href ? "page" : undefined}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-card px-4 text-sm font-bold whitespace-nowrap text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background aria-[current=page]:ring-foreground"
            >
              {Icon && <Icon className="size-4" aria-hidden />}
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
