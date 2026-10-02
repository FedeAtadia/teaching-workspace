import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveSidebar, SIDEBAR_COOKIE } from "@/lib/theme";

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  // NAV-1: read on the server, so a collapsed menu doesn't open and then jump.
  const sidebar = resolveSidebar((await cookies()).get(SIDEBAR_COOKIE)?.value);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        initial={sidebar}
        labels={{
          appName: t("app.name"),
          menu: t("nav.menu"),
          collapse: t("nav.collapse"),
          expand: t("nav.expand"),
          dashboard: t("nav.dashboard"),
          classes: t("nav.classes"),
          students: t("nav.students"),
          exams: t("nav.exams"),
          settings: t("nav.settings"),
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {!isSupabaseConfigured() && (
          <p className="bg-primary px-4 py-2 text-sm text-primary-foreground">{t("app.setupBanner")}</p>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
