import { ArrowRight, CalendarCheck, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Fragment, type CSSProperties } from "react";
import { cn } from "cn";
import { reveal } from "./reveal";

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
    <div aria-hidden className="lp-float overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_30px_60px_-30px_rgb(11_79_87/0.35)] dark:shadow-[0_30px_60px_-30px_rgb(0_0_0/0.7)]">
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
            <div className={number}>
              <span className="lp-count" style={{ "--n": 3 } as CSSProperties} />
            </div>
            <div className="text-[13px] text-muted-foreground">{t("classes")}</div>
          </div>
          <div className={tile}>
            <div className={number}>
              <span className="lp-count" style={{ "--n": 59 } as CSSProperties} />
            </div>
            <div className="text-[13px] text-muted-foreground">{t("students")}</div>
          </div>
          <div className={cn(tile, "border-primary bg-accent text-highlight")}>
            <div className={number}>
              <span className="lp-count" style={{ "--n": 12 } as CSSProperties} />
            </div>
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
                <div className="lp-fill h-full bg-accent-deep" style={{ width: `${k.pct}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{t("graded", { pct: k.pct })}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Watched = { name: string; course: string; reasons: string[] };

/** "Para seguir de cerca" as Inicio shows it (FOLLOW-1), with a printed report (REPORT-1) peeking behind. */
export async function FollowUpPreview() {
  const t = await getTranslations("landing.followUp");
  const students = t.raw("students") as Watched[];
  const rows = t.raw("reportRows") as [string, string][];
  return (
    <div aria-hidden className="relative flex w-full max-w-[460px] flex-col sm:block sm:pt-[76px]">
      {/* On a phone the report sits under the card, tucked into its corner; wider, above its title row. */}
      <div className="lp-float z-10 order-2 -mt-3 mr-2 self-end sm:absolute sm:top-0 sm:right-[-6px] sm:mt-0 sm:mr-0 w-[170px] rotate-[4deg] rounded-[14px] bg-white p-3.5 text-[11px] leading-[1.35] text-[#112d2e] shadow-[0_24px_50px_-28px_rgb(0_0_0/0.55)]">
        <div className="font-heading text-sm font-bold">{t("report")}</div>
        <div className="text-[#4d6a6c]">{t("reportStudent")}</div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-[3px]">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </Fragment>
          ))}
        </div>
        <div className="mt-2 rounded-md bg-[#dff1ef] px-1.5 py-1 text-center font-bold text-[#005f68]">{t("reportResult")}</div>
      </div>
      <div className="lp-lift relative rounded-[20px] border border-border bg-background p-5 shadow-[0_30px_60px_-34px_rgb(11_79_87/0.35)] dark:shadow-[0_30px_60px_-34px_rgb(0_0_0/0.7)]">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            <span className="lp-pulse absolute inset-0 rounded-full bg-destructive" />
            <span className="relative size-2.5 rounded-full bg-destructive" />
          </span>
          <span className="font-heading text-xl font-bold">{t("card")}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {students.map((w, i) => (
            <div key={w.name} {...reveal(i + 1)} className="flex flex-col gap-2 rounded-[14px] border border-border bg-card px-3.5 py-3">
              <div className="flex justify-between gap-2">
                <span className="font-bold">{w.name}</span>
                <span className="text-[13px] text-muted-foreground">{w.course}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {w.reasons.map((r) => (
                  <span key={r} className="rounded-full bg-alert-soft px-2.5 py-0.5 text-xs font-bold text-destructive">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SHEET = [
  ["Acosta", "Lara"],
  ["Benítez", "Juan"],
  ["Ferreyra", "Nahuel"],
  ["Paz", "Emilia"],
] as const;
/** Benítez is already in the class (IMPORT-3); the others are added. */
const ALREADY = "Benítez";

/** Cells from a spreadsheet, and the preview of what importing them adds (IMPORT-1, IMPORT-3). */
export async function ImportPreview() {
  const t = await getTranslations("landing.import");
  const cell = "border-r border-border px-2 py-1.5 last:border-r-0";
  return (
    <div aria-hidden className="flex flex-wrap items-center justify-center gap-3.5">
      <div className="lp-lift w-[200px] overflow-hidden rounded-[14px] border border-border bg-card text-[13px]">
        <div className="grid grid-cols-[28px_1fr_1fr] bg-muted font-bold text-muted-foreground">
          <span className={cell} />
          <span className={cell}>A</span>
          <span className={cell}>B</span>
        </div>
        {[[t("lastName"), t("firstName")] as const, ...SHEET].map(([a, b], i) => (
          <div key={a} className="grid grid-cols-[28px_1fr_1fr] border-t border-border">
            <span className={cn(cell, "bg-muted text-center text-muted-foreground")}>{i + 1}</span>
            <span className={cn(cell, i === 0 && "font-bold")}>{a}</span>
            <span className={cn(cell, i === 0 && "font-bold")}>{b}</span>
          </div>
        ))}
      </div>
      <ArrowRight strokeWidth={2.2} className="size-[34px] text-highlight max-sm:rotate-90" />
      <div className="lp-lift flex w-[230px] flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
        {SHEET.map(([last, first], i) => {
          const already = last === ALREADY;
          return (
            <div key={last} {...reveal(i + 2)} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold">
                {last}, {first}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  already ? "bg-muted text-muted-foreground" : "bg-accent text-highlight",
                )}
              >
                {t(already ? "already" : "add")}
              </span>
            </div>
          );
        })}
        <span className="mt-1 flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          {t("button")}
        </span>
      </div>
    </div>
  );
}
