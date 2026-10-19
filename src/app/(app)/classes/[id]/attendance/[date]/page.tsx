import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { AttendanceForm, NoClassForm } from "@/components/classes/AttendanceForm";
import { GroupFilter } from "@/components/classes/GroupFilter";
import { getAttendanceDay } from "@/db/queries/attendance";
import { listGroups } from "@/db/queries/groups";
import { weekdayOf } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { loadClass } from "../../data";
import { clearDayAction } from "../actions";

/** ATT-2, ATT-3: take one date's attendance, or say the class didn't happen. */
export default async function AttendanceDayPage({ params, searchParams }: PageProps<"/classes/[id]/attendance/[date]">) {
  const { id, date } = await params;
  const { group } = await searchParams;
  if (!z.iso.date().safeParse(date).success) notFound();
  const { db, teacherId, cls } = await loadClass(id);
  const [day, groups] = await Promise.all([getAttendanceDay(db, teacherId, cls, date), listGroups(db, teacherId, id)]);
  if (!day.ok && day.error === "notFound") notFound();

  const t = await getTranslations("attendance");
  const tGroups = await getTranslations("groups");
  const tDay = await getTranslations("weekdays");
  const tKind = await getTranslations("calendar.daysOff.kinds");
  const locale = await getLocale();
  const groupId = typeof group === "string" && groups.some((g) => g.id === group) ? group : undefined;
  const withGroup = groupId ? `group=${groupId}` : "";
  const title = `${tDay(String(weekdayOf(date)))} ${formatDate(date, locale)}`;
  const back = `/classes/${id}/attendance${day.ok ? `?term=${day.term}${withGroup && `&${withGroup}`}` : ""}`;

  if (!day.ok) {
    return (
      <>
        <BackLink href={back} label={t("day.back")} />
        <h2 className="mt-3 mb-2 text-xl font-extrabold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {day.error === "outsideYear" ? t("day.outsideYear") : t("noCalendar", { year: cls.schoolYear, school: cls.school })}
        </p>
        {day.error === "noCalendar" && (
          <Link
            href={`/settings/schools/${cls.schoolId}/calendar/${cls.schoolYear}`}
            className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            {t("openCalendar")}
          </Link>
        )}
      </>
    );
  }

  // GROUP-6: with a group shown, only its students are on the form, so saving changes only theirs.
  const rows = groupId ? day.rows.filter((r) => r.groupId === groupId) : day.rows;
  const { session, dayOff } = day;

  return (
    <>
      <BackLink href={back} label={t("day.back")} />
      <div className="mt-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {session && (
          <ConfirmDeleteButton
            label={t("day.clear.button")}
            title={t("day.clear.title", { date: formatDate(date, locale) })}
            body={t("day.clear.body")}
            action={clearDayAction.bind(null, { classId: id, date })}
          />
        )}
      </div>

      {dayOff && !session && (
        <p className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm">
          <span className="font-bold">{t("day.dayOff", { name: `${tKind(dayOff.kind)} · ${dayOff.name}` })}</span>{" "}
          <span className="text-muted-foreground">{t("day.dayOffNote")}</span>
        </p>
      )}
      {session && !session.held && (
        <p className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm font-bold">
          {t("day.notHeld", { reason: t(`reasons.${session.reason ?? "other"}`) })}
          {session.note && <span className="font-normal text-muted-foreground"> · {session.note}</span>}
        </p>
      )}

      <GroupFilter
        groups={groups}
        current={groupId}
        allLabel={tGroups("all")}
        href={(g) => `/classes/${id}/attendance/${date}${g ? `?group=${g}` : ""}`}
      />

      <div className="grid max-w-3xl gap-6">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("day.noStudents")}</p>
        ) : (
          <AttendanceForm
            // A fresh form per date and group, so switching never keeps the other's choices.
            key={`${date}:${groupId ?? ""}`}
            classId={id}
            date={date}
            rows={rows.map((r) => ({
              studentId: r.student.id,
              name: `${r.student.lastName}, ${r.student.firstName}`,
              status: r.status,
            }))}
          />
        )}
        <NoClassForm
          key={`${date}:no-class`}
          classId={id}
          date={date}
          current={session && !session.held ? { reason: session.reason, note: session.note } : null}
        />
      </div>
    </>
  );
}
