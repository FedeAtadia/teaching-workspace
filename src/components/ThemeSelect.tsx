"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setTheme } from "@/i18n/actions";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; icon: LucideIcon }[] = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
];

/** THEME-1: Sistema / Claro / Oscuro. */
export function ThemeSelect({ current, labels }: { current: Theme; labels: Record<Theme, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="radiogroup" className="inline-flex gap-1 rounded-2xl bg-muted p-1">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setTheme(value);
              // The class on <html> is set by the server (THEME-2), so re-render.
              router.refresh();
            })
          }
          className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm"
        >
          <Icon className="size-4" aria-hidden />
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
