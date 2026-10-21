"use client";

import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { cn } from "cn";
import { formatDate, parseDate, withSlashes } from "@/lib/format";

/**
 * INPUT-4: a date typed as DD/MM/YYYY whatever the browser's language, which
 * the browser's own date box would follow instead. It sends `name` as the
 * stored YYYY-MM-DD, as that box did, so the actions don't change; text that
 * isn't a date is sent as typed and the action rejects it.
 *
 * The calendar button opens the browser's picker on a hidden date input: a
 * grid of days reads the same in any language.
 */
export function DateField({
  id,
  name,
  defaultValue,
  min,
  max,
  invalid,
  label,
  className,
  onChange,
}: {
  id?: string;
  /** Without it nothing is submitted; `onChange` gets the date instead. */
  name?: string;
  /** YYYY-MM-DD, or what was typed when a submit is refilled after an error. */
  defaultValue?: string;
  min?: string;
  max?: string;
  invalid?: boolean;
  /** The accessible name, when no <label> points at `id`. */
  label?: string;
  className?: string;
  onChange?: (iso: string | null) => void;
}) {
  const t = useTranslations("common.date");
  const picker = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() =>
    defaultValue && /^\d{4}-\d{2}-\d{2}$/.test(defaultValue) ? formatDate(defaultValue) : (defaultValue ?? ""),
  );
  const iso = parseDate(text);

  function update(next: string) {
    setText(next);
    onChange?.(parseDate(next));
  }

  return (
    <div className={cn("flex w-44 items-center", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={t("placeholder")}
        maxLength={10}
        value={text}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(e) => update(withSlashes(e.target.value))}
        // A complete date is shown the one way: 5/3/2026 becomes 05/03/2026.
        onBlur={() => iso && setText(formatDate(iso))}
        className="h-9 w-full min-w-0 rounded-l-lg border border-r-0 border-input bg-transparent px-2.5 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
      />
      <button
        type="button"
        aria-label={t("pick")}
        title={t("pick")}
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          if (typeof el.showPicker === "function") el.showPicker();
          else el.focus();
        }}
        className="relative flex h-9 w-10 shrink-0 items-center justify-center rounded-r-lg border border-input text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-input/30"
      >
        <CalendarDays className="size-4" aria-hidden />
        <input
          ref={picker}
          type="date"
          tabIndex={-1}
          aria-hidden
          min={min}
          max={max}
          value={iso ?? ""}
          onChange={(e) => e.target.value && update(formatDate(e.target.value))}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </button>
      {name && <input type="hidden" name={name} value={iso ?? text.trim()} />}
    </div>
  );
}
