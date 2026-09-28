import { getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listClassStudents } from "@/db/queries/classDetail";
import { loadClass } from "./data";

export default async function ClassStudentsPage({ params }: PageProps<"/classes/[id]">) {
  const { id } = await params;
  const { db, teacherId } = await loadClass(id);
  const t = await getTranslations("classPage.students");
  const roster = await listClassStudents(db, teacherId, id);

  if (roster.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("count", { count: roster.length })}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>{t("lastName")}</TableHead>
            <TableHead>{t("firstName")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((s, i) => (
            <TableRow key={s.id}>
              <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
              <TableCell className="font-medium">{s.lastName}</TableCell>
              <TableCell>{s.firstName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
