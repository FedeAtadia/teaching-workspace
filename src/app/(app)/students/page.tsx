import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { AddStudentDialog } from "@/components/students/AddStudentDialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db";
import { listCourses } from "@/db/queries/classes";
import { listStudents } from "@/db/queries/students";
import { requireTeacherId } from "@/lib/auth";
import { formatCourse, type Shift } from "@/lib/courses";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function StudentsPage() {
  const t = await getTranslations("students");
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
  const [courses, students] = await Promise.all([listCourses(db, teacherId), listStudents(db, teacherId)]);

  // The school only adds noise for a teacher at one school; with two, it tells the courses apart.
  const severalSchools = new Set(courses.map((c) => c.school)).size > 1;
  const courseLabel = (c: { year: number; division: string; shift: Shift; schoolYear: string; school: string }) =>
    `${formatCourse(c.year, c.division)} · ${tShift(c.shift)} · ${c.schoolYear}` + (severalSchools ? ` · ${c.school}` : "");

  const action =
    courses.length > 0 ? (
      <AddStudentDialog courses={courses.map((c) => ({ id: c.id, label: courseLabel(c) }))} />
    ) : (
      <Button disabled>{t("add")}</Button>
    );

  return (
    <PageHeader title={t("title")} action={action}>
      {courses.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("noCourses")}{" "}
          <Link href="/classes" className="underline underline-offset-4">
            {t("goToClasses")}
          </Link>
        </p>
      )}
      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{t("columns.lastName")}</TableHead>
                <TableHead>{t("columns.firstName")}</TableHead>
                <TableHead>{t("columns.course")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                // NAV-2: the first cell's link stretches over the whole row.
                <TableRow key={s.id} className="relative cursor-pointer has-[a:focus-visible]:bg-muted">
                  <TableCell className="pl-5 font-bold">
                    <Link
                      href={`/students/${s.id}`}
                      className="outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      {s.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{s.firstName}</TableCell>
                  <TableCell className="text-muted-foreground">{s.courses.map(courseLabel).join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageHeader>
  );
}
