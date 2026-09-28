import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listTerms } from "@/db/queries/classDetail";
import { getGradebook, listTasks } from "@/db/queries/tasks";
import { formatGrade } from "@/lib/format";
import { DEFAULT_RULES, isPassing } from "@/lib/grading";
import { loadClass } from "../data";

/** BOOK-1..3: one cuatrimestre at a time, chosen with ?term=1 or ?term=2. */
export default async function GradesPage({ params, searchParams }: PageProps<"/classes/[id]/grades">) {
  const { id } = await params;
  const { term: termParam } = await searchParams;
  const { db, teacherId, cls } = await loadClass(id);
  const [terms, tasks] = await Promise.all([listTerms(db, teacherId, cls), listTasks(db, teacherId, cls)]);

  // Default to the latest cuatrimestre that has tasks: the one being taught.
  const latestWithTasks = Math.max(1, ...tasks.map((t) => t.termPosition));
  const position = termParam === "1" || termParam === "2" ? Number(termParam) : latestWithTasks;
  const term = terms.find((t) => t.position === position) ?? terms[0];

  const t = await getTranslations("classPage.grades");
  const tTerm = await getTranslations("terms");
  const locale = await getLocale();
  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };
  const book = term ? await getGradebook(db, teacherId, cls, term.id) : { tasks: [], rows: [] };

  return (
    <>
      <nav className="mb-4 flex gap-2">
        {terms.map((tm) => (
          <Link
            key={tm.id}
            href={`/classes/${id}/grades?term=${tm.position}`}
            aria-current={tm.id === term?.id ? "page" : undefined}
            className="rounded-md border px-3 py-1 text-sm text-muted-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
          >
            {tTerm(String(tm.position))}
          </Link>
        ))}
      </nav>

      {book.tasks.length === 0 || book.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{book.rows.length === 0 ? t("noStudents") : t("noTasks")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 bg-muted px-3 py-2 text-left font-medium">{t("student")}</th>
                {book.tasks.map((task) => (
                  <th key={task.id} className="px-2 py-2 font-medium">
                    <Link
                      href={`/classes/${id}/tasks/${task.id}`}
                      title={task.title}
                      className="block max-w-28 truncate hover:underline"
                    >
                      {task.title}
                    </Link>
                  </th>
                ))}
                <th className="border-l px-3 py-2 font-medium">{t("average")}</th>
              </tr>
            </thead>
            <tbody>
              {book.rows.map(({ student, cells, suggestion }) => (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="sticky left-0 bg-background px-3 py-1.5 font-medium whitespace-nowrap">
                    {student.lastName}, {student.firstName}
                  </td>
                  {cells.map((cell, i) => (
                    <td key={book.tasks[i].id} className="px-2 py-1.5 text-center tabular-nums">
                      {cell === null ? (
                        ""
                      ) : cell.status === "missing" ? (
                        <abbr title={t("missing")} className="text-destructive no-underline">
                          {t("missingShort")}
                        </abbr>
                      ) : cell.status === "excused" ? (
                        <abbr title={t("excused")} className="text-muted-foreground no-underline">
                          {t("excusedShort")}
                        </abbr>
                      ) : cell.value === null ? (
                        ""
                      ) : (
                        <span className={isPassing(cell.value, rules) ? "" : "font-medium text-destructive"}>
                          {formatGrade(cell.value, locale)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="border-l px-3 py-1.5 text-center whitespace-nowrap tabular-nums">
                    {suggestion.average === null ? (
                      "—"
                    ) : (
                      <span
                        className={isPassing(suggestion.average, rules) ? "font-medium" : "font-medium text-destructive"}
                      >
                        {formatGrade(suggestion.average, locale)}
                      </span>
                    )}
                    {suggestion.missing > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({suggestion.missing} {t("missingShort")})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t("legend", { passMark: formatGrade(rules.passMark, locale) })}</p>
    </>
  );
}
