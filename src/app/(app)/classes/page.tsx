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
import { listClasses } from "@/db/queries/classes";
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

  const rows = await listClasses(getDb(), await requireTeacherId());
  return (
    <PageHeader title={t("title")} action={<AddClassDialog defaultSchoolYear={new Date().getFullYear()} />}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
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
            {rows.map((c) => (
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
      )}
    </PageHeader>
  );
}
