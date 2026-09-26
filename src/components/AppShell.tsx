import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const NAV = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/classes", key: "classes" },
  { href: "/students", key: "students" },
  { href: "/settings", key: "settings" },
] as const;

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <nav className="flex gap-1 border-b border-black/10 p-3 md:w-56 md:flex-col md:border-r md:border-b-0 dark:border-white/15">
        <span className="mb-4 hidden px-3 font-semibold md:block">{t("app.name")}</span>
        {NAV.map(({ href, key }) => (
          <Link
            key={href}
            href={href}
            className="rounded-md px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t(`nav.${key}`)}
          </Link>
        ))}
      </nav>
      <div className="flex flex-1 flex-col">
        {!isSupabaseConfigured() && (
          <p className="bg-amber-100 px-4 py-2 text-sm text-amber-900">{t("app.setupBanner")}</p>
        )}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
