"use client";

import {
  BookOpen,
  ClipboardCheck,
  House,
  LogOut,
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
import { signOutAction } from "@/app/(app)/actions";
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
  signOut: string;
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
        {/* NAV-4: the bottom bar has no room for it. */}
        <form action={signOutAction} className="ml-auto">
          <button
            type="submit"
            className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-sidebar-foreground"
          >
            <LogOut className="size-5" aria-hidden />
            {labels.signOut}
          </button>
        </form>
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
          "sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3 py-5 transition-[width] duration-150 md:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className={cn("mb-6 flex items-center gap-2", collapsed ? "flex-col" : "justify-between pl-3")}>
          {/* Collapsed: the mark alone. Expanded: the mark and "annora" with its blue "o". */}
          {collapsed ? <LogoMark className="mt-2 size-9" /> : <Logo name={labels.appName} />}
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
        {/* NAV-4 */}
        <form action={signOutAction}>
          <button
            type="submit"
            title={collapsed ? labels.signOut : undefined}
            aria-label={collapsed ? labels.signOut : undefined}
            className={cn(
              "flex h-11 w-full items-center gap-3 rounded-xl text-[15px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-sidebar-foreground",
              collapsed ? "justify-center" : "px-4",
            )}
          >
            <LogOut className="size-5 shrink-0" aria-hidden />
            {!collapsed && <span>{labels.signOut}</span>}
          </button>
        </form>
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
        "flex h-11 items-center gap-3 rounded-xl text-[15px] font-semibold transition-colors",
        compact ? "justify-center" : "px-4",
        // The mocks' filled pill: dark text on the blue, as the palette requires.
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!compact && <span>{label}</span>}
    </Link>
  );
}
