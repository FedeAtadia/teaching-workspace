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
      className="rounded-md border border-black/15 bg-background px-3 py-2 dark:border-white/20"
    >
      {Object.entries(LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
