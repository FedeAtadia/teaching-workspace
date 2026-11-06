"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";

const LABELS: Record<string, string> = { "es-AR": "Español (Argentina)", en: "English" };

export function LanguageSelect({ current }: { current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await setLocale(e.target.value);
          router.refresh();
        })
      }
      className="h-10 w-full rounded-xl border border-input bg-muted px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {Object.entries(LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
