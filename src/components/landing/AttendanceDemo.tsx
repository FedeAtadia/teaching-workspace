"use client";

import { Check, Hand } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { cn } from "cn";
import { DEMO_MARKS, DEMO_START, DEMO_STUDENTS, demoTotals, type DemoMark } from "@/lib/attendanceDemo";

/** Each mark's colours when on, as in the app's attendance (ATT-2). */
const ON: Record<DemoMark, [string, string]> = {
  present: ["var(--primary)", "var(--primary-foreground)"],
  absent: ["var(--destructive)", "var(--background)"],
  late: ["var(--foreground)", "var(--background)"],
  excused: ["var(--muted-foreground)", "var(--background)"],
};
const OFF: [string, string] = ["var(--muted)", "var(--muted-foreground)"];

/** Rows the animation taps, and how many seconds into its loop: Benítez absent, then Díaz late. */
const ANIMATED: Record<number, number> = { 1: 0.6, 3: 1.6 };

/**
 * The home page's drawn phone, taking a day's attendance (LAND-7). Until the
 * visitor taps a letter it plays by itself; then the marks are theirs, the
 * totals follow and "Guardar" shows it saved. Nothing leaves the page.
 */
export function AttendanceDemo() {
  const t = useTranslations("landing.attendance");
  const tShort = useTranslations("attendance.short");
  const tStatus = useTranslations("attendance.statuses");
  const [marks, setMarks] = useState<DemoMark[] | null>(null);
  const [saved, setSaved] = useState(false);
  const touched = marks !== null;
  const current = marks ?? DEMO_START;

  function mark(row: number, value: DemoMark) {
    const next = current.slice();
    next[row] = value;
    setMarks(next);
    setSaved(false);
  }

  return (
    <div className="flex w-full flex-col items-center gap-3.5">
      <span
        aria-hidden={touched}
        className={cn(
          "lp-blink inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-sm font-bold text-highlight transition-opacity",
          touched && "invisible opacity-0",
        )}
      >
        <Hand aria-hidden className="size-[18px]" />
        {t("hint")}
      </span>
      <div className="lp-float w-full max-w-[320px] rounded-[40px] bg-[#0b171b] p-3 dark:bg-black">
        <div
          role="group"
          aria-label={t("demo")}
          className="flex flex-col gap-2.5 overflow-hidden rounded-[30px] bg-background px-3.5 py-[18px] text-foreground"
        >
          <div className="flex items-center justify-between">
            <span className="font-heading text-xl font-bold">{t("day")}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-bold",
                saved ? "bg-primary text-primary-foreground" : "bg-accent text-highlight",
              )}
            >
              {t(saved ? "saved" : touched ? "unsaved" : "untaken")}
            </span>
          </div>
          <div className="lp-blink flex items-center gap-2 rounded-xl bg-muted px-2.5 py-[7px] text-xs font-semibold text-muted-foreground">
            <span className="relative flex size-2" aria-hidden>
              <span className="lp-pulse absolute inset-0 rounded-full bg-primary" />
              <span className="relative size-2 rounded-full bg-primary" />
            </span>
            {t("offlineStrip")}
          </div>
          <ul className="rounded-2xl border border-border bg-card">
            {DEMO_STUDENTS.map((name, row) => (
              <li
                key={name}
                className="flex items-center justify-between gap-2 border-b border-background py-[9px] pr-2.5 pl-3 last:border-b-0"
              >
                <span className="truncate text-sm font-semibold">{name}</span>
                <span className="flex shrink-0 gap-1">
                  {DEMO_MARKS.map((m) => {
                    const on = current[row] === m;
                    const [bg, fg] = on ? ON[m] : OFF;
                    const delay = ANIMATED[row];
                    // Until the first tap, the animated rows loop between present and their mark.
                    const animation = !touched && delay !== undefined ? (m === "present" ? "lp-untap" : on ? "lp-tap" : "") : "";
                    const style = {
                      background: bg,
                      color: fg,
                      "--on-bg": ON[m][0],
                      "--on-fg": ON[m][1],
                      "--off-bg": OFF[0],
                      "--off-fg": OFF[1],
                      animationDelay: animation ? `${delay}s` : undefined,
                    } as CSSProperties;
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${name}: ${tStatus(m)}`}
                        onClick={() => mark(row, m)}
                        style={style}
                        className={cn(
                          "lp-mark flex size-[30px] cursor-pointer items-center justify-center rounded-full text-xs font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
                          animation,
                        )}
                      >
                        {tShort(m)}
                      </button>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="flex justify-center gap-3 text-xs font-semibold text-muted-foreground">
            {demoTotals(current).map((x) => (
              <span key={x.mark}>{t(`totals.${x.mark}`, { count: x.count })}</span>
            ))}
          </p>
          <button
            type="button"
            onClick={() => {
              setMarks(current);
              setSaved(true);
            }}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-[14px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
              saved ? "bg-accent-deep text-white" : "bg-primary text-primary-foreground",
            )}
          >
            {saved && <Check aria-hidden strokeWidth={2.6} className="lp-pop size-[18px]" />}
            {t(saved ? "saved" : "save")}
          </button>
        </div>
      </div>
    </div>
  );
}
