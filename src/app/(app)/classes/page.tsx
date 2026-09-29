import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AddClassDialog } from "@/components/classes/AddClassDialog";
import { PageHeader } from "@/components/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db";
import { listClasses, listSchools, type ClassRow } from "@/db/queries/classes";
import { requireTeacherId } from "@/lib/auth";
import { formatCourse } from "@/lib/courses";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ClassesPage() {
  const t = await getTranslations("classes");
  const tShift = await getTranslations("shifts");
  const tCommon = await getTranslations("common");

  if (!isSupabaseConfigured()) {
    return (
      <PageHeader title={t("title")}>
        <p className="text-sm text-muted-foreground">{tCommon("notConfigured")}</p>
      </PageHeader>
    );
  }

  const db = getDb();
  const teacherId = await requireTeacherId();
  const [rows, schools] = await Promise.all([listClasses(db, teacherId), listSchools(db, teacherId)]);

  // Grouped by school (COURSE-3 already orders them school by school within a year).
  const bySchool = new Map<string, ClassRow[]>();
  for (const row of [...rows].sort((a, b) => a.school.localeCompare(b.school, "es"))) {
    bySchool.set(row.school, [...(bySchool.get(row.school) ?? []), row]);
  }

  return (
    <PageHeader
      title={t("title")}
      action={
        <AddClassDialog defaultSchoolYear={new Date().getFullYear()} schools={schools.map((s) => s.name)} />
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-8">
          {[...bySchool.entries()].map(([school, list]) => (
            <section key={school}>
              <h2 className="mb-2 text-lg font-semibold">{school}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.subject")}</TableHead>
                    <TableHead>{t("columns.course")}</TableHead>
                    <TableHead>{t("columns.shift")}</TableHead>
                    <TableHead>{t("columns.schoolYear")}</TableHead>
                    <TableHead className="text-right">{t("columns.students")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link href={`/classes/${c.id}`} className="underline-offset-4 hover:underline">
                          {c.name}
                        </Link>
                      </TableCell>
                      <TableCell>{formatCourse(c.year, c.division)}</TableCell>
                      <TableCell>{tShift(c.shift)}</TableCell>
                      <TableCell>{c.schoolYear}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.students}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </PageHeader>
  );
}
