"use client";

import {
  BookOpen,
  ClipboardCheck,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { Logo, LogoMark } from "@/components/Logo";
import { setSidebar } from "@/i18n/actions";
import type { SidebarState } from "@/lib/theme";

type Labels = {
  appName: string;
  menu: string;
  collapse: string;
  expand: string;
  dashboard: string;
  classes: string;
  students: string;
  exams: string;
  settings: string;
  /** "Configuración" doesn't fit under an icon in the phone's bar. */
  settingsShort: string;
};

const ITEMS: { href: string; key: keyof Labels; icon: LucideIcon }[] = [
  { href: "/dashboard", key: "dashboard", icon: House },
  { href: "/classes", key: "classes", icon: BookOpen },
  { href: "/students", key: "students", icon: Users },
  { href: "/exams", key: "exams", icon: ClipboardCheck },
];

/**
 * NAV-1: a side menu that collapses to its icons; on a phone, a bar at the
 * bottom of the screen, within reach of the thumb.
 */
export function Sidebar({ initial, labels }: { initial: SidebarState; labels: Labels }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initial === "collapsed");

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    void setSidebar(next ? "collapsed" : "expanded");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Phones and small tablets: the name on top, the menu at the bottom. */}
      <header className="flex h-14 items-center border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        <Logo name={labels.appName} />
      </header>
      <nav
        aria-label={labels.menu}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-sidebar-border bg-sidebar px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {[...ITEMS, { href: "/settings", key: "settingsShort" as const, icon: Settings }].map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition-colors",
                active ? "text-highlight" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-[22px]" aria-hidden />
              {labels[item.key]}
            </Link>
          );
        })}
      </nav>

      {/* Tablets and up: the side menu. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-150 md:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className={cn("mb-4 flex items-center gap-2", collapsed ? "flex-col" : "justify-between pl-3")}>
          {collapsed ? <LogoMark className="mt-2" /> : <Logo name={labels.appName} />}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? labels.expand : labels.collapse}
            title={collapsed ? labels.expand : labels.collapse}
            aria-expanded={!collapsed}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
          </button>
        </div>
        <nav aria-label={labels.menu} className="flex flex-1 flex-col gap-1">
          {ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={labels[item.key]}
              icon={item.icon}
              active={isActive(item.href)}
              compact={collapsed}
            />
          ))}
          <div className="flex-grow" />
          <NavLink
            href="/settings"
            label={labels.settings}
            icon={Settings}
            active={isActive("/settings")}
            compact={collapsed}
          />
        </nav>
      </aside>
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  compact,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  compact: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={cn(
        "flex h-12 items-center gap-3 rounded-xl text-[15px] font-bold transition-colors",
        compact ? "justify-center" : "px-4",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!compact && <span>{label}</span>}
    </Link>
  );
}
