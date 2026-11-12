import { ClipboardPaste, Download, FileSpreadsheet, Sheet } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BackLink } from "@/components/BackLink";
import { RosterImport } from "@/components/students/RosterImport";
import { getDb } from "@/db";
import { listCourses } from "@/db/queries/classes";
import { listStudents } from "@/db/queries/students";
import { requireTeacherId } from "@/lib/auth";
import { formatCourse } from "@/lib/courses";
import { MAX_IMPORT_ROWS } from "@/lib/rosterImport";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** IMPORT-1..5 */
export default async function ImportStudentsPage({ searchParams }: PageProps<"/students/import">) {
  const t = await getTranslations("rosterImport");
  const tStudents = await getTranslations("students");
  const tShift = await getTranslations("shifts");
  const tCommon = await getTranslations("common");

  if (!isSupabaseConfigured()) return <p className="text-sm text-muted-foreground">{tCommon("notConfigured")}</p>;

  const db = getDb();
  const teacherId = await requireTeacherId();
  const [courses, students, params] = await Promise.all([
    listCourses(db, teacherId),
    listStudents(db, teacherId),
    searchParams,
  ]);
  const severalSchools = new Set(courses.map((c) => c.school)).size > 1;
  const inCourse: Record<string, { lastName: string; firstName: string }[]> = {};
  for (const s of students) {
    for (const c of s.courses) (inCourse[c.id] ??= []).push({ lastName: s.lastName, firstName: s.firstName });
  }

  // IMPORT-5: an example to open in Excel. The mark at its start makes Excel read the accents right.
  const template = `﻿${t("guide.lastName")};${t("guide.firstName")}\r\nPérez;Ana\r\nGómez;Luis\r\nÁlvarez;Zoe\r\n`;
  const example = [
    ["Pérez", "Ana"],
    ["Gómez", "Luis"],
    ["Álvarez", "Zoe"],
  ];

  return (
    <>
      <BackLink href="/students" label={t("back")} />
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 mb-8 text-lg text-muted-foreground">{t("intro")}</p>

      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tStudents("noCourses")}{" "}
          <Link href="/classes" className="underline underline-offset-4">
            {tStudents("goToClasses")}
          </Link>
        </p>
      ) : (
        <div className="grid gap-8">
          {/* IMPORT-5: how to make the list, open the first time and foldable after. */}
          <details open className="group rounded-2xl bg-card ring-1 ring-border">
            <summary className="flex cursor-pointer items-center gap-2.5 rounded-2xl p-5 text-xl font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
              <FileSpreadsheet className="size-5 text-highlight" aria-hidden />
              {t("guide.title")}
            </summary>
            <div className="grid gap-6 border-t border-border p-5 sm:p-6 lg:grid-cols-2">
              <div className="grid content-start gap-3">
                <h3 className="font-heading text-lg leading-tight font-bold">{t("guide.sheetTitle")}</h3>
                {/* A drawn spreadsheet, not a screenshot: it follows the theme and the language. */}
                <table aria-hidden className="w-full max-w-sm border-collapse overflow-hidden rounded-lg text-sm ring-1 ring-border">
                  <thead>
                    <tr className="bg-muted text-center text-xs text-muted-foreground">
                      <th className="w-8 border border-border py-1" />
                      <th className="border border-border py-1 font-semibold">A</th>
                      <th className="border border-border py-1 font-semibold">B</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-border bg-muted text-center text-xs text-muted-foreground">1</td>
                      <td className="border border-border px-2 py-1 font-bold">{t("guide.lastName")}</td>
                      <td className="border border-border px-2 py-1 font-bold">{t("guide.firstName")}</td>
                    </tr>
                    {example.map(([last, first], i) => (
                      <tr key={last}>
                        <td className="border border-border bg-muted text-center text-xs text-muted-foreground">{i + 2}</td>
                        <td className="border border-border px-2 py-1">{last}</td>
                        <td className="border border-border px-2 py-1">{first}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="grid list-disc gap-1.5 pl-5 text-sm">
                  {(t.raw("guide.rules") as string[]).map((_, i) => (
                    <li key={i}>{t(`guide.rules.${i}`, { max: MAX_IMPORT_ROWS })}</li>
                  ))}
                </ul>
                <p className="mt-1 grid gap-1 text-sm">
                  <a
                    href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}
                    download={t("guide.templateFile")}
                    className="inline-flex items-center gap-2 justify-self-start font-semibold text-highlight underline underline-offset-4"
                  >
                    <Download className="size-4" aria-hidden />
                    {t("guide.template")}
                  </a>
                  <span className="text-muted-foreground">{t("guide.templateHint")}</span>
                </p>
              </div>
              <div className="grid content-start gap-5">
                <Steps icon={<ClipboardPaste className="size-5" aria-hidden />} title={t("guide.pasteTitle")} steps={t.raw("guide.paste") as string[]} />
                <Steps icon={<FileSpreadsheet className="size-5" aria-hidden />} title={t("guide.excelTitle")} steps={t.raw("guide.excel") as string[]} />
                <Steps icon={<Sheet className="size-5" aria-hidden />} title={t("guide.sheetsTitle")} steps={t.raw("guide.sheets") as string[]} />
              </div>
            </div>
          </details>

          <RosterImport
            courses={courses.map((c) => ({
              id: c.id,
              label:
                `${formatCourse(c.year, c.division)} · ${tShift(c.shift)} · ${c.schoolYear}` +
                (severalSchools ? ` · ${c.school}` : ""),
            }))}
            inCourse={inCourse}
            initialCourseId={courses.find((c) => c.id === params.course)?.id ?? (courses.length === 1 ? courses[0].id : "")}
          />
        </div>
      )}
    </>
  );
}

/** One way of getting the list out of a spreadsheet, as numbered steps. */
function Steps({ icon, title, steps }: { icon: ReactNode; title: string; steps: string[] }) {
  return (
    <div className="grid gap-2">
      <h3 className="flex items-center gap-2 font-heading text-lg leading-tight font-bold">
        <span className="text-highlight">{icon}</span>
        {title}
      </h3>
      <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
