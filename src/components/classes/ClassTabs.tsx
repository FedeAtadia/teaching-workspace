"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The tabs under a class's header; each tab is its own route. */
export function ClassTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // The first tab is the class root, which every other tab's path starts with.
  const active = [...tabs].reverse().find((t) => pathname.startsWith(t.href))?.href;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
