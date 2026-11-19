// DUPLA-1, DUPLA-2: matching a student across two teachers' accounts. The
// same person is two records, one per teacher; they are taken to be the same
// when their names match, ignoring case and accents, in the same school year.
// Pure, so the rule is tested without a database.

import { nameKey } from "./rosterImport";

export type Candidate = {
  /** Where they are: the shared class (or one's own course) they were found in. */
  placeId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  schoolYear: string;
};

/**
 * DUPLA-1: the candidates that are the student, one per place at most. A place
 * with two students of that name is left out: guessing between them could show
 * one student's grades as another's.
 */
export function matchStudent(
  student: { firstName: string; lastName: string; schoolYears: readonly string[] },
  candidates: readonly Candidate[],
): Candidate[] {
  const key = nameKey(student);
  const years = new Set(student.schoolYears);
  const byPlace = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!years.has(c.schoolYear) || nameKey(c) !== key) continue;
    byPlace.set(c.placeId, [...(byPlace.get(c.placeId) ?? []), c]);
  }
  return [...byPlace.values()].filter((found) => new Set(found.map((c) => c.studentId)).size === 1).map(([c]) => c);
}
