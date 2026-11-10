"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "cn";
import { setLocale } from "@/i18n/actions";

const OPTIONS = [
  { value: "es-AR", label: "ES", lang: "es" },
  { value: "en", label: "EN", lang: "en" },
];

/** The home page's Español / English switch (LAND-3), stored like the one in Configuración (LOCALE-2). */
export function LanguageToggle({ large = false }: { large?: boolean }) {
  const t = useTranslations("landing.nav");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="group" aria-label={t("language")} className="flex rounded-[10px] bg-muted p-[3px] text-[13px] font-bold">
      {OPTIONS.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            lang={o.lang}
            aria-pressed={on}
            disabled={pending}
            onClick={() => {
              if (on) return;
              startTransition(async () => {
                await setLocale(o.value);
                router.refresh();
              });
            }}
            className={cn(
              "rounded-lg transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              large ? "h-9 px-3.5" : "h-[30px] px-2.5",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
