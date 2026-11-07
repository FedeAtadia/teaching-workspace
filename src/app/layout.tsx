import "@fontsource-variable/league-spartan";
import "@fontsource-variable/outfit";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cn } from "cn";
import { htmlThemeClass, PALETTE_COOKIE, resolvePalette, resolveTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Annora",
  description: "Classes, students, tasks and grades in one place.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const jar = await cookies();
  // THEME-2, THEME-3: applied while rendering, so the page never paints another theme first.
  const theme = resolveTheme(jar.get(THEME_COOKIE)?.value);
  const palette = resolvePalette(jar.get(PALETTE_COOKIE)?.value);
  return (
    <html lang={locale} data-palette={palette} className={cn("h-full font-sans antialiased", htmlThemeClass(theme))}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
