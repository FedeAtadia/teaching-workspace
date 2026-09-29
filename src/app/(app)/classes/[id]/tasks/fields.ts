import { getTranslations } from "next-intl/server";
import type { FieldSpec } from "@/components/forms/FormDialog";
import type { StandardRow, TermRow, UnitRow } from "@/db/queries/classDetail";
import type { TaskDetail } from "@/db/queries/tasks";

/**
 * The task form's fields (TASK-1, TASK-2), for adding one or, given the task,
 * for changing it (TASK-6) with each field holding its current value.
 */
export async function taskFields(
  lists: { terms: TermRow[]; units: UnitRow[]; standards: StandardRow[] },
  task?: TaskDetail,
): Promise<FieldSpec[]> {
  const t = await getTranslations("classPage.tasks");
  const tTerm = await getTranslations("terms");
  const { terms, units, standards } = lists;
  return [
    { kind: "text", name: "title", label: t("fields.title"), maxLength: 120, defaultValue: task?.title },
    {
      kind: "select",
      name: "termId",
      label: t("fields.term"),
      options: terms.map((term) => ({ value: term.id, label: tTerm(String(term.position)) })),
      defaultValue: task?.termId ?? terms[0]?.id,
    },
    {
      kind: "select",
      name: "unitId",
      label: t("fields.unit"),
      options: [{ value: "", label: t("fields.noUnit") }, ...units.map((u) => ({ value: u.id, label: u.title }))],
      defaultValue: task?.unitId ?? "",
    },
    { kind: "date", name: "dueOn", label: t("fields.date"), defaultValue: task?.dueOn ?? undefined },
    {
      kind: "textarea",
      name: "description",
      label: t("fields.description"),
      maxLength: 280,
      rows: 2,
      defaultValue: task?.description ?? undefined,
    },
    {
      kind: "textarea",
      name: "criteria",
      label: t("fields.criteria"),
      maxLength: 1000,
      rows: 3,
      defaultValue: task?.criteria ?? undefined,
    },
    ...(standards.length > 0
      ? [
          {
            kind: "checkboxes" as const,
            name: "standardIds",
            label: t("fields.standards"),
            options: standards.map((s) => ({ value: s.id, label: s.title })),
            defaultValue: task?.standards.map((s) => s.id),
          },
        ]
      : []),
  ];
}
