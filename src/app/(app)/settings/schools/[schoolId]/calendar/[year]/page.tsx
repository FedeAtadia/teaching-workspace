import { CalendarRange, CalendarX2, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog, type FieldSpec } from "@/components/forms/FormDialog";
import { AddHolidaysButton } from "@/components/settings/AddHolidaysButton";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { getCalendar } from "@/db/queries/calendar";
import { requireTeacherId } from "@/lib/auth";
import { DAY_OFF_KINDS, type DayOff } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { addDayOffAction, editDayOffAction, removeDayOff, saveCalendarAction } from "../../../../actions";

/** CAL-1..3: one school's calendar for one school year. */
export default async function CalendarPage({ params }: PageProps<"/settings/schools/[schoolId]/calendar/[year]">) {
  const { schoolId, year } = await params;
  if (!isSupabaseConfigured()) notFound();
  const data = await getCalendar(getDb(), await requireTeacherId(), schoolId, year);
  if (!data) notFound();

  const t = await getTranslations("calendar");
  const { calendar, daysOff } = data;
  const errors = { notFound: t("errors.notFound") };

  const dateFields: FieldSpec[] = (["startsOn", "term2StartsOn", "endsOn"] as const).map((name) => ({
    kind: "date",
    name,
    label: t(`dates.${name}`),
    defaultValue: calendar?.[name],
  }));

  const dayOffFields = (current?: DayOff): FieldSpec[] => [
    {
      kind: "select",
      name: "kind",
      label: t("daysOff.fields.kind"),
      options: DAY_OFF_KINDS.map((k) => ({ value: k, label: t(`daysOff.kinds.${k}`) })),
      defaultValue: current?.kind ?? "jornada",
    },
    {
      kind: "text",
      name: "name",
      label: t("daysOff.fields.name"),
      maxLength: 120,
      placeholder: t("daysOff.fields.namePlaceholder"),
      defaultValue: current?.name,
    },
    { kind: "date", name: "startsOn", label: t("daysOff.fields.startsOn"), defaultValue: current?.startsOn },
    {
      kind: "date",
      name: "endsOn",
      label: t("daysOff.fields.endsOn"),
      defaultValue: current && current.endsOn !== current.startsOn ? current.endsOn : undefined,
    },
  ];

  // How many entries of each kind, from the list already loaded.
  const totals = DAY_OFF_KINDS.map((kind) => ({ kind, count: daysOff.filter((d) => d.kind === kind).length }));

  return (
    <>
      <BackLink href="/settings" label={t("back")} />
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("title", { year: data.schoolYear })}</h1>
      <p className="mt-1 mb-8 text-lg text-muted-foreground">{data.school}</p>

      <div className="grid max-w-5xl gap-6">
        <section className="grid gap-5 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle icon={CalendarRange}>{t("dates.title")}</CardTitle>
            <FormDialog
              trigger={calendar ? "edit" : "addSmall"}
              triggerLabel={calendar ? t("dates.edit") : t("dates.set")}
              title={t("dates.title")}
              action={saveCalendarAction}
              hidden={{ schoolId: data.schoolId, schoolYear: data.schoolYear }}
              formErrors={errors}
              fields={dateFields}
            />
          </div>
          {calendar ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              {(["startsOn", "term2StartsOn", "endsOn"] as const).map((name) => (
                <div key={name} className="grid gap-2 rounded-xl bg-muted/60 p-4">
                  <dt className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:text-xs">
                    {t(`dates.${name}`)}
                  </dt>
                  <dd className="font-heading text-3xl leading-none font-bold tabular-nums">
                    {formatDate(calendar[name])}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t("dates.missing")}</p>
          )}
        </section>

        {calendar && (
          <section className="grid gap-5 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="grid max-w-prose gap-2">
                <CardTitle icon={CalendarX2}>{t("daysOff.title")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("daysOff.intro")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AddHolidaysButton calendarId={calendar.id} year={data.schoolYear} />
                <FormDialog
                  trigger="addSmall"
                  triggerLabel={t("daysOff.add")}
                  title={t("daysOff.addTitle")}
                  action={addDayOffAction}
                  hidden={{ calendarId: calendar.id }}
                  formErrors={errors}
                  fields={dayOffFields()}
                />
              </div>
            </div>
            {daysOff.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("daysOff.empty")}</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {totals.map(({ kind, count }) => (
                    <div
                      key={kind}
                      className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-4 py-3"
                    >
                      <dt className="text-sm text-muted-foreground">{t(`daysOff.totals.${kind}`)}</dt>
                      <dd className="font-heading text-xl font-bold tabular-nums">{count}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="grid gap-2">
                  {daysOff.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 rounded-xl bg-muted/60 py-2.5 pr-2 pl-4 sm:gap-5"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-5">
                        <p className="shrink-0 sm:w-32">
                          <span className="block font-heading text-xl leading-tight font-bold tabular-nums">
                            {formatDate(d.startsOn)}
                          </span>
                          {d.endsOn !== d.startsOn && (
                            <span className="block text-xs text-muted-foreground tabular-nums">
                              {t("daysOff.until", { date: formatDate(d.endsOn) })}
                            </span>
                          )}
                        </p>
                        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                          <Badge tone={d.kind === "holiday" ? "accent" : "neutral"}>
                            {t(`daysOff.kinds.${d.kind}`)}
                          </Badge>
                          <span className="min-w-0 font-medium">{d.name}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <FormDialog
                          trigger="editIcon"
                          triggerLabel={t("daysOff.edit")}
                          title={t("daysOff.editTitle")}
                          action={editDayOffAction}
                          hidden={{ calendarId: calendar.id, dayOffId: d.id }}
                          formErrors={errors}
                          fields={dayOffFields(d)}
                        />
                        <ConfirmDeleteButton
                          iconOnly
                          label={t("daysOff.delete")}
                          title={t("daysOff.deleteTitle", { name: d.name })}
                          body={t("daysOff.deleteBody")}
                          action={removeDayOff.bind(null, { dayOffId: d.id })}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}

/** A card's title with its icon in a tinted square. */
function CardTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-bold tracking-tight">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-highlight-soft text-highlight" aria-hidden>
        <Icon className="size-5" />
      </span>
      {children}
    </h2>
  );
}
