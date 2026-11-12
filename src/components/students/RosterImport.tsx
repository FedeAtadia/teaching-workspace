"use client";

import { CircleAlert, CircleCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";
import { importRosterAction } from "@/app/(app)/students/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { decodeCsv, MAX_IMPORT_ROWS, parseRoster, rosterStatus } from "@/lib/rosterImport";

type Name = { lastName: string; firstName: string };
type Done = { added: number; skipped: number; courseId: string; course: string };

/**
 * IMPORT-1..4: pick the course, give the list (a CSV file or pasted cells),
 * look at what was read, then add it. The list is read in the browser as it
 * is typed or picked; nothing is saved until the button is pressed.
 */
export function RosterImport({
  courses,
  inCourse,
  initialCourseId,
}: {
  courses: { id: string; label: string }[];
  /** Who is active in each course, to mark who is already there (IMPORT-3). */
  inCourse: Record<string, Name[]>;
  initialCourseId: string;
}) {
  const t = useTranslations("rosterImport");
  const fileInput = useRef<HTMLInputElement>(null);
  const [courseId, setCourseId] = useState(initialCourseId);
  const [text, setText] = useState("");
  /** Lines of the file the teacher unticked. */
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<"courseNotFound" | "invalid" | "unreadable" | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseRoster(text), [text]);
  const status = useMemo(
    () => rosterStatus(parsed.rows, inCourse[courseId] ?? []),
    [parsed.rows, inCourse, courseId],
  );
  const chosen = parsed.rows.filter((r, i) => status[i] === "new" && !excluded.has(r.line));

  function setList(next: string) {
    setText(next);
    setExcluded(new Set());
    setError(null);
    setDone(null);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      setList(decodeCsv(await file.arrayBuffer()));
    } catch {
      setError("unreadable");
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await importRosterAction({
        courseId,
        students: chosen.map(({ lastName, firstName }) => ({ lastName, firstName })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({
        added: result.added,
        skipped: result.skipped,
        courseId,
        course: courses.find((c) => c.id === courseId)?.label ?? "",
      });
      setText("");
      setExcluded(new Set());
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Label htmlFor="import-course">{t("course")}</Label>
        <NativeSelect
          id="import-course"
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setDone(null);
            setError(null);
          }}
          className="w-full sm:w-96"
        >
          <NativeSelectOption value="" disabled>
            {t("chooseCourse")}
          </NativeSelectOption>
          {courses.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_auto_1fr] md:items-start">
        <div className="grid gap-2">
          <Label htmlFor="import-file">{t("file")}</Label>
          <input
            ref={fileInput}
            id="import-file"
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => void readFile(e.target.files?.[0])}
            className="max-w-full text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-3.5 file:text-sm file:font-semibold file:text-primary-foreground"
          />
          <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground md:mt-9">{t("or")}</p>
        <div className="grid gap-2">
          <Label htmlFor="import-paste">{t("paste")}</Label>
          <textarea
            id="import-paste"
            value={text}
            onChange={(e) => setList(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder={t("pastePlaceholder")}
            className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
      </div>

      {done && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-highlight-soft p-4">
          <CircleCheck className="size-5 shrink-0 text-highlight" aria-hidden />
          <span className="min-w-0 flex-1 basis-64">
            {t("done", { added: done.added, course: done.course })}
            {done.skipped > 0 && ` ${t("skipped", { count: done.skipped })}`}
          </span>
          <Link
            href={`/students?course=${done.courseId}`}
            className="font-semibold text-highlight underline underline-offset-4"
          >
            {t("seeCourse")}
          </Link>
        </p>
      )}

      <section className="grid gap-3">
        <h2 className="text-xl font-bold">{t("preview")}</h2>
        {parsed.rows.length === 0 && parsed.errors.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {parsed.tooMany && (
          <p role="alert" className="text-sm text-destructive">
            {t("tooMany", { max: MAX_IMPORT_ROWS })}
          </p>
        )}
        {parsed.errors.length > 0 && (
          <div role="alert" className="grid gap-1 rounded-2xl bg-alert-soft p-4 text-sm">
            <p className="flex items-center gap-2 font-bold text-destructive">
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              {t("problems.title", { count: parsed.errors.length })}
            </p>
            <ul className="grid gap-0.5 pl-6">
              {parsed.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  {t("problems.line", { line: e.line, problem: t(`problems.${e.problem}`), text: e.text })}
                </li>
              ))}
            </ul>
          </div>
        )}
        {parsed.rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  <th className="w-px py-2.5 pr-2 pl-4">
                    <span className="sr-only">{t("columns.include")}</span>
                  </th>
                  <th className="px-3 py-2.5">{t("columns.line")}</th>
                  <th className="px-3 py-2.5">{t("columns.lastName")}</th>
                  <th className="px-3 py-2.5">{t("columns.firstName")}</th>
                  <th className="px-3 py-2.5">{t("columns.status")}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((r, i) => {
                  const isNew = status[i] === "new";
                  return (
                    <tr key={r.line} className="border-t border-border">
                      <td className="py-2 pr-2 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`${t("columns.include")}: ${r.lastName}, ${r.firstName}`}
                          disabled={!isNew}
                          checked={isNew && !excluded.has(r.line)}
                          onChange={(e) => {
                            const next = new Set(excluded);
                            if (e.target.checked) next.delete(r.line);
                            else next.add(r.line);
                            setExcluded(next);
                          }}
                          className="size-4 accent-primary"
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{r.line}</td>
                      <td className="px-3 py-2 font-bold">{r.lastName}</td>
                      <td className="px-3 py-2">{r.firstName}</td>
                      <td className="px-3 py-2">
                        <Badge tone={isNew ? "accent" : "outline"}>{t(`status.${status[i]}`)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
      {parsed.rows.length > 0 && (
        <Button
          type="button"
          onClick={submit}
          disabled={pending || chosen.length === 0 || courseId === ""}
          className="justify-self-start"
        >
          <Upload aria-hidden />
          {pending ? t("submitting") : t("submit", { count: chosen.length })}
        </Button>
      )}
    </div>
  );
}
