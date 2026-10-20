import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { FormDialog, type FieldSpec } from "@/components/forms/FormDialog";
import { AddHolidaysButton } from "@/components/settings/AddHolidaysButton";
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
  const locale = await getLocale();
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

  const when = (d: DayOff) =>
    d.startsOn === d.endsOn
      ? formatDate(d.startsOn, locale)
      : `${formatDate(d.startsOn, locale)} – ${formatDate(d.endsOn, locale)}`;

  return (
    <>
      <BackLink href="/settings" label={t("back")} />
      <h1 className="mt-3 text-3xl font-bold">{t("title", { year: data.schoolYear })}</h1>
      <p className="mt-1 mb-6 text-muted-foreground">{data.school}</p>

      <div className="grid max-w-2xl gap-8">
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">{t("dates.title")}</h2>
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
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              {(["startsOn", "term2StartsOn", "endsOn"] as const).map((name) => (
                <div key={name}>
                  <dt className="text-muted-foreground">{t(`dates.${name}`)}</dt>
                  <dd className="font-bold">{formatDate(calendar[name], locale)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("dates.missing")}</p>
          )}
        </section>

        {calendar && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("daysOff.title")}</h2>
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
            <p className="mt-1 mb-3 text-sm text-muted-foreground">{t("daysOff.intro")}</p>
            <div className="mb-4">
              <AddHolidaysButton calendarId={calendar.id} year={data.schoolYear} />
            </div>
            {daysOff.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("daysOff.empty")}</p>
            ) : (
              <ul className="grid gap-2">
                {daysOff.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-card py-2.5 pr-2 pl-4 ring-1 ring-border"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`daysOff.kinds.${d.kind}`)} · {when(d)}
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
            )}
          </section>
        )}
      </div>
    </>
  );
}
