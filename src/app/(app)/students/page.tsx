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

  const courseLabel = (c: { year: number; division: string; shift: Shift; schoolYear: string }) =>
    `${formatCourse(c.year, c.division)} · ${tShift(c.shift)} · ${c.schoolYear}`;

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.lastName")}</TableHead>
              <TableHead>{t("columns.firstName")}</TableHead>
              <TableHead>{t("columns.course")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link href={`/students/${s.id}`} className="underline-offset-4 hover:underline">
                    {s.lastName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/students/${s.id}`} className="underline-offset-4 hover:underline">
                    {s.firstName}
                  </Link>
                </TableCell>
                <TableCell>{s.courses.map(courseLabel).join(", ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageHeader>
  );
}
