import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AttendanceChart } from "@/components/classes/AttendanceChart";
import { GoToDate } from "@/components/classes/GoToDate";
import { GroupFilter } from "@/components/classes/GroupFilter";
import { getAttendanceSheet } from "@/db/queries/attendance";
import { listGroups } from "@/db/queries/groups";
import { getMinAttendance } from "@/db/queries/settings";
import { belowMinimum, type AttendanceCell, type ClassDay } from "@/lib/attendance";
import { todayInArgentina, weekdayOf } from "@/lib/calendar";
import { formatShortDate } from "@/lib/format";
import { loadClass } from "../data";

/** ATT-1, ATT-4..6: one cuatrimestre at a time (?term=1 or 2), one group or all (?group=). */
export default async function AttendancePage({ params, searchParams }: PageProps<"/classes/[id]/attendance">) {
  const { id } = await params;
  const { term, group } = await searchParams;
  const { db, teacherId, cls } = await loadClass(id);
  const groups = await listGroups(db, teacherId, id);
  const groupId = typeof group === "string" && groups.some((g) => g.id === group) ? group : undefined;
  const requested = term === "1" || term === "2" ? Number(term) : undefined;
  const [sheet, minimum] = await Promise.all([
    getAttendanceSheet(db, teacherId, cls, requested, groupId),
    getMinAttendance(db, teacherId),
  ]);

  const t = await getTranslations("attendance");
  const tTerm = await getTranslations("terms");
  const tGroups = await getTranslations("groups");
  const tDay = await getTranslations("weekdaysShort");
  const tKind = await getTranslations("calendar.daysOff.kinds");

  // ATT-6
  if (!sheet.ok) {
    return (
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <p className="text-sm">{t("noCalendar", { year: cls.schoolYear, school: cls.school })}</p>
        <Link
          href={`/settings/schools/${cls.schoolId}/calendar/${cls.schoolYear}`}
          className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          {t("openCalendar")}
        </Link>
      </div>
    );
  }

  const withGroup = groupId ? `&group=${groupId}` : "";
  const dayHref = (date: string) =>
    `/classes/${id}/attendance/${date}${groupId ? `?group=${groupId}` : ""}`;
  const today = todayInArgentina();
  const dayTitle = (d: ClassDay) =>
    d.state === "off"
      ? `${tKind(d.dayOff!.kind)}: ${d.dayOff!.name}`
      : d.state === "notHeld"
        ? `${t("states.notHeld")}: ${t(`reasons.${d.session!.reason ?? "other"}`)}${d.session!.note ? ` (${d.session!.note})` : ""}`
        : t(`states.${d.state}`);

  const cell = (c: AttendanceCell) =>
    c === null ? (
      ""
    ) : c === "notExpected" ? (
      <abbr title={t("notExpected")} className="text-muted-foreground/60 no-underline">
        {t("short.notExpected")}
      </abbr>
    ) : (
      <abbr
        title={t(`statuses.${c}`)}
        className={
          c === "absent"
            ? "font-bold text-destructive no-underline"
            : c === "present"
              ? "text-muted-foreground no-underline"
              : "font-bold no-underline"
        }
      >
        {t(`short.${c}`)}
      </abbr>
    );

  return (
    <>
      <nav className="mb-4 flex gap-2">
        {([1, 2] as const).map((position) => (
          <Link
            key={position}
            href={`/classes/${id}/attendance?term=${position}${withGroup}`}
            aria-current={position === sheet.position ? "page" : undefined}
            className="flex h-10 items-center rounded-full bg-muted px-4 text-sm font-bold text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {tTerm(String(position))}
          </Link>
        ))}
      </nav>
      <GroupFilter
        groups={groups}
        current={groupId}
        allLabel={tGroups("all")}
        href={(g) => `/classes/${id}/attendance?term=${sheet.position}${g ? `&group=${g}` : ""}`}
      />

      {!sheet.hasWeekdays && <p className="mb-4 text-sm text-muted-foreground">{t("noWeekdays")}</p>}

      {sheet.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
      ) : sheet.days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noDays")}</p>
      ) : (
        <>
          {/* On a phone: the days as a strip to tap, then one card per student. */}
          <div className="md:hidden">
            <ul className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {sheet.days.map((d) => {
                const blank = d.state === "off" || d.state === "notHeld";
                return (
                  <li key={d.date} className="shrink-0">
                    <Link
                      href={dayHref(d.date)}
                      title={dayTitle(d)}
                      aria-current={d.date === today ? "date" : undefined}
                      className={`flex h-14 w-12 flex-col items-center justify-center rounded-xl text-sm font-bold ring-1 aria-[current=date]:ring-2 aria-[current=date]:ring-primary ${
                        blank
                          ? "bg-muted text-muted-foreground line-through ring-border"
                          : d.state === "taken"
                            ? "bg-highlight-soft text-accent-foreground ring-transparent"
                            : "bg-card ring-border"
                      }`}
                    >
                      <span className="text-[0.7rem] font-medium">{tDay(String(weekdayOf(d.date)))}</span>
                      <span className="tabular-nums">{formatShortDate(d.date)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ul className="grid gap-2">
              {sheet.rows.map(({ student, counts }) => {
                const low = belowMinimum(counts.rate, minimum);
                return (
                  <li key={student.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/students/${student.id}`} className="font-bold">
                        {student.lastName}, <span className="font-normal">{student.firstName}</span>
                      </Link>
                      <span className={`font-heading text-xl font-bold tabular-nums ${low ? "text-destructive" : ""}`}>
                        {counts.rate === null ? "—" : `${counts.rate} %`}
                      </span>
                    </div>
                    <div className="relative mt-2 h-2 rounded-full bg-muted">
                      {counts.rate !== null && (
                        <div
                          className={`absolute inset-y-0 left-0 rounded-r-[4px] ${low ? "bg-alert" : "bg-primary"}`}
                          style={{ width: `${Math.max(counts.rate, 1)}%` }}
                        />
                      )}
                      {minimum > 0 && (
                        <div
                          className="absolute -inset-y-1 border-l-2 border-dashed border-muted-foreground"
                          style={{ left: `${minimum}%` }}
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="mt-2 flex justify-between gap-2 text-sm text-muted-foreground">
                      <span className="tabular-nums">
                        {(["present", "absent", "late", "excused"] as const)
                          .map((s) => `${t(`short.${s}`)} ${counts[s]}`)
                          .join(" · ")}
                      </span>
                      {low && <span className="font-bold text-destructive">{t("chart.below")}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-border md:block">
            <table className="text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="sticky left-0 z-10 bg-muted px-4 py-3 text-left font-bold">{t("student")}</th>
                  {sheet.days.map((d) => (
                    <th key={d.date} className="px-0.5 py-1.5 font-medium">
                      <Link
                        href={dayHref(d.date)}
                        title={dayTitle(d)}
                        aria-current={d.date === today ? "date" : undefined}
                        className={`flex min-w-9 flex-col items-center rounded-lg px-1 py-0.5 leading-tight hover:bg-background aria-[current=date]:ring-2 aria-[current=date]:ring-primary ${
                          d.state === "off" || d.state === "notHeld"
                            ? "text-muted-foreground/70 line-through decoration-1"
                            : d.state === "pending" && d.date <= today
                              ? "text-foreground"
                              : d.state === "pending"
                                ? "text-muted-foreground"
                                : "text-foreground"
                        }`}
                      >
                        <span className="text-[0.7rem] text-muted-foreground no-underline">
                          {tDay(String(weekdayOf(d.date)))}
                        </span>
                        <span className="tabular-nums">{formatShortDate(d.date)}</span>
                      </Link>
                    </th>
                  ))}
                  <th className="border-l px-3 py-2 font-medium">{t("rate")}</th>
                  {(["present", "absent", "late", "excused"] as const).map((s) => (
                    <th key={s} className="px-2 py-2 font-medium">
                      <abbr title={t(`statuses.${s}`)} className="no-underline">
                        {t(`short.${s}`)}
                      </abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map(({ student, cells, counts }) => (
                  <tr key={student.id} className="border-b last:border-0 hover:bg-muted/60">
                    <td className="sticky left-0 bg-card px-4 py-2 font-bold whitespace-nowrap">
                      <Link href={`/students/${student.id}`} className="hover:underline">
                        {student.lastName}, <span className="font-normal">{student.firstName}</span>
                      </Link>
                    </td>
                    {cells.map((c, i) => {
                      const d = sheet.days[i];
                      const blank = d.state === "off" || d.state === "notHeld";
                      return (
                        <td
                          key={d.date}
                          className={`px-0.5 py-1.5 text-center ${blank ? "bg-muted/50" : ""}`}
                        >
                          {cell(c)}
                        </td>
                      );
                    })}
                    <td className="border-l px-3 py-1.5 text-center font-bold whitespace-nowrap tabular-nums">
                      {counts.rate === null ? (
                        "—"
                      ) : (
                        <span className={belowMinimum(counts.rate, minimum) ? "text-destructive" : ""}>
                          {counts.rate} %
                        </span>
                      )}
                    </td>
                    {(["present", "absent", "late", "excused"] as const).map((s) => (
                      <td key={s} className="px-2 py-1.5 text-center text-muted-foreground tabular-nums">
                        {counts[s]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {sheet.rows.length > 0 && sheet.days.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{t("legend")}</p>
      )}

      <GoToDate
        basePath={`/classes/${id}/attendance`}
        query={groupId ? `?group=${groupId}` : ""}
        min={sheet.calendar.startsOn}
        max={sheet.calendar.endsOn}
        initial={today < sheet.calendar.startsOn || today > sheet.calendar.endsOn ? sheet.calendar.startsOn : today}
        label={t("otherDate.label")}
        go={t("otherDate.go")}
      />

      {/* The phone's cards above already show each one's percentage against the minimum. */}
      {sheet.rows.length > 0 && (
        <div className="hidden md:block">
          <AttendanceChart
            title={t("chart.title")}
            minimum={minimum}
            minimumLabel={t("chart.minimum", { min: minimum })}
            emptyLabel={t("chart.none")}
            belowLabel={t("chart.below")}
            rows={sheet.rows.map(({ student, counts }) => ({
              id: student.id,
              name: `${student.lastName}, ${student.firstName}`,
              rate: counts.rate,
              below: belowMinimum(counts.rate, minimum),
              detail: (["present", "absent", "late", "excused"] as const)
                .map((s) => `${t(`short.${s}`)} ${counts[s]}`)
                .join(" · "),
            }))}
          />
        </div>
      )}
    </>
  );
}
