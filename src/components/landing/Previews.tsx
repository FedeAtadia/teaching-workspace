import { CalendarCheck, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "cn";

// Drawings of the app for the home page, not the app itself: fixed sample
// data, hidden from screen readers (the text around them says the same).

const CLASSES = [
  { name: "math", line: "mathLine", pct: 72, stripe: "bg-primary" },
  { name: "physics", line: "physicsLine", pct: 92, stripe: "bg-[#2ec4b6]" },
] as const;

/** Inicio in a browser window: the totals, today's attendance button and two class cards. */
export async function HomePreview() {
  const t = await getTranslations("landing.preview");
  const tile = "rounded-[14px] border border-border p-3";
  const number = "font-heading text-[26px] leading-tight font-bold";
  return (
    <div aria-hidden className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_30px_60px_-30px_rgb(11_79_87/0.35)] dark:shadow-[0_30px_60px_-30px_rgb(0_0_0/0.7)]">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 rounded-full bg-border" />
        ))}
        <span className="ml-2.5 text-[13px] text-muted-foreground">{t("tab")}</span>
      </div>
      <div className="flex flex-col gap-3.5 p-5 sm:p-[22px]">
        <div className={number}>{t("hello")}</div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className={tile}>
            <div className={number}>3</div>
            <div className="text-[13px] text-muted-foreground">{t("classes")}</div>
          </div>
          <div className={tile}>
            <div className={number}>59</div>
            <div className="text-[13px] text-muted-foreground">{t("students")}</div>
          </div>
          <div className={cn(tile, "border-primary bg-accent text-highlight")}>
            <div className={number}>12</div>
            <div className="text-[13px] leading-snug">{t("toGrade")}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground">
          <CalendarCheck className="size-[22px] shrink-0" />
          <span className="grow">
            <span className="block font-bold">{t("today")}</span>
            <span className="block text-[13px] opacity-90">{t("todayClass")}</span>
          </span>
          <ChevronRight className="size-[18px] shrink-0" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {CLASSES.map((k) => (
            <div key={k.name} className="relative overflow-hidden rounded-2xl border border-border px-3.5 pt-[18px] pb-3.5">
              <span className={cn("absolute inset-x-0 top-0 h-1.5", k.stripe)} />
              <div className="font-bold">{t(k.name)}</div>
              <div className="text-[13px] text-muted-foreground">{t(k.line)}</div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-accent-deep" style={{ width: `${k.pct}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{t("graded", { pct: k.pct })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ROLL = [
  ["Álvarez, Zoe", "present"],
  ["Benítez, Juan", "absent"],
  ["Castro, Valentina", "present"],
  ["Díaz, Martina", "late"],
  ["Gómez, Lucía", "present"],
] as const;

const MARKS = ["present", "absent", "late", "excused"] as const;

const MARK_ON: Record<(typeof MARKS)[number], string> = {
  present: "bg-primary text-primary-foreground",
  absent: "bg-destructive text-background",
  late: "bg-foreground text-background",
  excused: "bg-muted-foreground text-background",
};

/** A day's attendance on a phone, as ATT-2 shows it. */
export async function PhonePreview() {
  const t = await getTranslations("landing.attendance");
  const tShort = await getTranslations("attendance.short");
  const tState = await getTranslations("attendance.states");
  return (
    <div aria-hidden className="w-full max-w-[320px] rounded-[40px] bg-[#0b171b] p-3 dark:bg-black">
      <div className="flex flex-col gap-2.5 overflow-hidden rounded-[30px] bg-background px-3.5 py-[18px] text-foreground">
        <div className="flex items-center justify-between">
          <span className="font-heading text-xl font-bold">{t("day")}</span>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-highlight">{tState("pending")}</span>
        </div>
        <div className="rounded-2xl border border-border bg-card">
          {ROLL.map(([name, mark]) => (
            <div key={name} className="flex items-center justify-between gap-2 border-b border-background py-[9px] pr-2.5 pl-3 last:border-b-0">
              <span className="truncate text-sm font-semibold">{name}</span>
              <span className="flex shrink-0 gap-1">
                {MARKS.map((m) => (
                  <span
                    key={m}
                    className={cn(
                      "flex size-[30px] items-center justify-center rounded-full text-xs font-bold",
                      m === mark ? MARK_ON[m] : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tShort(m)}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <span className="flex h-11 items-center justify-center rounded-[14px] bg-primary font-bold text-primary-foreground">{t("save")}</span>
      </div>
    </div>
  );
}
