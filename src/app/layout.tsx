import "@fontsource-variable/nunito";
import "@fontsource/caveat/700.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cn } from "cn";
import { htmlThemeClass, resolveTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teaching workspace",
  description: "Classes, students, tasks and grades in one place.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  // THEME-2: applied while rendering, so the page never paints the other theme first.
  const theme = resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang={locale} className={cn("h-full font-sans antialiased", htmlThemeClass(theme))}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
