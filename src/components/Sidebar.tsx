"use client";

import {
  BookOpen,
  ClipboardCheck,
  House,
  Menu,
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
};

const ITEMS: { href: string; key: keyof Labels; icon: LucideIcon }[] = [
  { href: "/dashboard", key: "dashboard", icon: House },
  { href: "/classes", key: "classes", icon: BookOpen },
  { href: "/students", key: "students", icon: Users },
  { href: "/exams", key: "exams", icon: ClipboardCheck },
];

/** NAV-1: a side menu that collapses to its icons; on a phone, a menu button and a sheet. */
export function Sidebar({ initial, labels }: { initial: SidebarState; labels: Labels }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initial === "collapsed");
  const [sheetOpen, setSheetOpen] = useState(false);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    void setSidebar(next ? "collapsed" : "expanded");
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const links = (compact: boolean, onNavigate?: () => void) => (
    <>
      {ITEMS.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={labels[item.key]}
          icon={item.icon}
          active={isActive(item.href)}
          compact={compact}
          onNavigate={onNavigate}
        />
      ))}
      <div className="flex-grow" />
      <NavLink
        href="/settings"
        label={labels.settings}
        icon={Settings}
        active={isActive("/settings")}
        compact={compact}
        onNavigate={onNavigate}
      />
    </>
  );

  return (
    <>
      {/* Phones and small tablets: a top bar and a sheet. */}
      <header className="flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 py-2 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            aria-label={labels.menu}
            className="flex size-11 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-1 bg-sidebar p-4">
            <SheetTitle className="mb-4 px-2 font-chalk text-4xl font-bold text-foreground">{labels.appName}</SheetTitle>
            <nav aria-label={labels.menu} className="flex flex-1 flex-col gap-1">
              {links(false, () => setSheetOpen(false))}
            </nav>
          </SheetContent>
        </Sheet>
        <span className="font-chalk text-3xl leading-none font-bold">{labels.appName}</span>
      </header>

      {/* Tablets and up: the side menu. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 bg-sidebar p-3 transition-[width] duration-150 md:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className={cn("mb-4 flex items-center gap-2", collapsed ? "justify-center" : "justify-between pl-3")}>
          {!collapsed && <span className="font-chalk text-3xl leading-none font-bold">{labels.appName}</span>}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? labels.expand : labels.collapse}
            title={collapsed ? labels.expand : labels.collapse}
            aria-expanded={!collapsed}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
          </button>
        </div>
        <nav aria-label={labels.menu} className="flex flex-1 flex-col gap-1">
          {links(collapsed)}
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
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  compact: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={cn(
        "flex h-12 items-center gap-3 rounded-xl text-[15px] font-bold transition-colors",
        compact ? "justify-center" : "px-4",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!compact && <span>{label}</span>}
    </Link>
  );
}
