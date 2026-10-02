import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AdaptedBadge } from "@/components/classes/Adaptation";
import { GroupFilter } from "@/components/classes/GroupFilter";
import { getAdaptations } from "@/db/queries/adaptations";
import { listTerms } from "@/db/queries/classDetail";
import { listGroups } from "@/db/queries/groups";
import { getGradebook, listTasks } from "@/db/queries/tasks";
import { formatGrade } from "@/lib/format";
import { DEFAULT_RULES, isPassing } from "@/lib/grading";
import { loadClass } from "../data";

/** BOOK-1..3, TERM-7: one cuatrimestre at a time, chosen with ?term=1 or ?term=2. */
export default async function GradesPage({ params, searchParams }: PageProps<"/classes/[id]/grades">) {
  const { id } = await params;
  const { term: termParam, group } = await searchParams;
  const { db, teacherId, cls } = await loadClass(id);
  const [terms, tasks, groups, adaptations] = await Promise.all([
    listTerms(db, teacherId, cls),
    listTasks(db, teacherId, cls),
    listGroups(db, teacherId, id),
    getAdaptations(db, teacherId, id),
  ]);
  // GROUP-6: one group, or all.
  const groupId = typeof group === "string" && groups.some((g) => g.id === group) ? group : undefined;
  const withGroup = groupId ? `&group=${groupId}` : "";

  // Default to the latest cuatrimestre that has tasks: the one being taught.
  const latestWithTasks = Math.max(1, ...tasks.map((t) => t.termPosition));
  const position = termParam === "1" || termParam === "2" ? Number(termParam) : latestWithTasks;
  const term = terms.find((t) => t.position === position) ?? terms[0];

  const t = await getTranslations("classPage.grades");
  const tTerm = await getTranslations("terms");
  const locale = await getLocale();
  const rules = { ...DEFAULT_RULES, passMark: cls.passMark ?? DEFAULT_RULES.passMark };
  const book = term ? await getGradebook(db, teacherId, cls, term.id, groupId) : { tasks: [], rows: [] };
  const tGroups = await getTranslations("groups");

  return (
    <>
      <nav className="mb-4 flex gap-2">
        {terms.map((tm) => (
          <Link
            key={tm.id}
            href={`/classes/${id}/grades?term=${tm.position}${withGroup}`}
            aria-current={tm.id === term?.id ? "page" : undefined}
            className="flex h-10 items-center rounded-full bg-muted px-4 text-sm font-bold text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {tTerm(String(tm.position))}
          </Link>
        ))}
      </nav>
      <GroupFilter
        groups={groups}
        current={groupId}
        allLabel={tGroups("all")}
        href={(g) => `/classes/${id}/grades?term=${term?.position ?? 1}${g ? `&group=${g}` : ""}`}
      />

      {book.tasks.length === 0 || book.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{book.rows.length === 0 ? t("noStudents") : t("noTasks")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border">
          <table className="text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="sticky left-0 z-10 bg-muted px-4 py-3 text-left font-bold">{t("student")}</th>
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
                <th className="px-3 py-2 font-medium">
                  <Link href={`/classes/${id}/term-grades?term=${term?.position ?? 1}`} className="hover:underline">
                    {t("termGrade")}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {book.rows.map(({ student, cells, suggestion, termGrade }) => (
                // NAV-2: the student's name link stretches over the row, to their history.
                <tr key={student.id} className="relative border-b last:border-0 hover:bg-muted/60 has-[a:focus-visible]:bg-muted">
                  <td className="sticky left-0 bg-card px-4 py-2 font-bold whitespace-nowrap">
                    <Link
                      href={`/students/${student.id}`}
                      className="outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      {student.lastName}, <span className="font-normal">{student.firstName}</span>
                    </Link>
                    {/* ADAPT-1 */}
                    {adaptations.has(student.id) && <AdaptedBadge notes={adaptations.get(student.id)!} />}
                  </td>
                  {cells.map((cell, i) => (
                    <td key={book.tasks[i].id} className="px-2 py-1.5 text-center tabular-nums">
                      {cell === "notAssessed" ? (
                        // GROUP-5: not this student's group's task.
                        <abbr title={t("notAssessed")} className="text-muted-foreground/60 no-underline">
                          {t("notAssessedShort")}
                        </abbr>
                      ) : cell === null ? (
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
                          {/* ADAPT-4 */}
                          {cell.adapted && (
                            <abbr title={t("adapted")} className="ml-0.5 align-super text-[0.65rem] text-chalk no-underline">
                              {t("adaptedShort")}
                            </abbr>
                          )}
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
                  {/* TERM-7 */}
                  <td className="px-3 py-1.5 text-center font-bold tabular-nums">
                    {termGrade === null ? (
                      "—"
                    ) : (
                      <span className={isPassing(termGrade, rules) ? "" : "text-destructive"}>
                        {formatGrade(termGrade, locale)}
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
