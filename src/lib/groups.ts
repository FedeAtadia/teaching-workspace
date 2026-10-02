// Groups within a class (GROUP-3). Pure: the one place that decides who is
// assessed on a task. The SQL counts in src/db/queries/groups.ts
// (`assessedSql`) follow the same rule.

/**
 * GROUP-3: a task with no groups is for everyone; otherwise only students of
 * a listed group are assessed on it, and a student with no group isn't.
 */
export function isAssessed(taskGroupIds: readonly string[], studentGroupId: string | null | undefined): boolean {
  if (taskGroupIds.length === 0) return true;
  return studentGroupId != null && taskGroupIds.includes(studentGroupId);
}

/** GROUP-3, TASK-3: a group task is dated by its earliest group date. */
export function groupTaskDate(groups: { dueOn: string | null }[], ownDate: string | null): string | null {
  if (groups.length === 0) return ownDate;
  const dates = groups.flatMap((g) => (g.dueOn ? [g.dueOn] : [])).sort();
  return dates[0] ?? null;
}
