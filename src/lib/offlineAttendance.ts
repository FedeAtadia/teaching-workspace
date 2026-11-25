// OFFLINE-2..4: attendance kept on the phone until it reaches the server.
// Pure: every function takes the drafts and answers new ones, and reading or
// writing goes through a Storage passed in, so the rules are tested without
// a browser. Kept per teacher, so another account on the same phone never
// sends or sees them.

import { ATTENDANCE_STATUSES, type AttendanceStatus } from "./attendance";

/**
 * - unsaved: marks tapped, "Guardar" not pressed yet. Only brought back into
 *   the day's form; never sent on their own.
 * - pending: saved on the phone, waiting to reach the server.
 * - conflict: the day was saved from somewhere else since (OFFLINE-3).
 * - failed: the server refused it for good (the class or date is gone).
 */
export type DraftState = "unsaved" | "pending" | "conflict" | "failed";

export type Marks = Record<string, AttendanceStatus>;

export type Draft = {
  classId: string;
  date: string;
  /** How the day reads in a notice: "5° A Matemática · Martes 13/11". */
  label: string;
  marks: Marks;
  /** OFFLINE-3: the version of the day the marks were taken from; null with nothing saved. */
  baseVersion: number | null;
  state: DraftState;
  /** When it last changed, in ms: a send only settles the draft it sent. */
  updatedAt: number;
  /** OFFLINE-3: the day as saved now, when it clashed. */
  current?: { held: boolean; marks: Marks };
  /** Why the server refused it, when failed. */
  error?: string;
};

export type Drafts = Record<string, Draft>;

/** The part of the browser's Storage used here. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const draftKey = (classId: string, date: string) => `${classId}:${date}`;
export const storageKey = (teacherId: string) => `annora.attendance.v1.${teacherId}`;

const STATES: readonly DraftState[] = ["unsaved", "pending", "conflict", "failed"];
const isMarks = (v: unknown): v is Marks =>
  typeof v === "object" &&
  v !== null &&
  Object.values(v).every((s) => (ATTENDANCE_STATUSES as readonly string[]).includes(s as string));
const isDraft = (v: unknown): v is Draft => {
  const d = v as Draft;
  return (
    typeof d === "object" &&
    d !== null &&
    typeof d.classId === "string" &&
    typeof d.date === "string" &&
    typeof d.label === "string" &&
    isMarks(d.marks) &&
    (d.baseVersion === null || typeof d.baseVersion === "number") &&
    STATES.includes(d.state) &&
    typeof d.updatedAt === "number"
  );
};

/** The teacher's drafts; whatever can't be read is left out rather than breaking the page. */
export function readDrafts(store: KeyValueStore, teacherId: string): Drafts {
  try {
    const parsed: unknown = JSON.parse(store.getItem(storageKey(teacherId)) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, d]) => isDraft(d))) as Drafts;
  } catch {
    return {};
  }
}

export function writeDrafts(store: KeyValueStore, teacherId: string, drafts: Drafts): void {
  if (Object.keys(drafts).length === 0) store.removeItem(storageKey(teacherId));
  else store.setItem(storageKey(teacherId), JSON.stringify(drafts));
}

type Day = { classId: string; date: string; label: string; baseVersion: number | null };

/**
 * OFFLINE-2: a mark tapped is kept at once. A day already on the phone keeps
 * the version it came from; tapping again after "Guardar" makes it unsaved
 * until saved again.
 */
export function recordMark(drafts: Drafts, day: Day, studentId: string, status: AttendanceStatus, now: number): Drafts {
  const key = draftKey(day.classId, day.date);
  const before = drafts[key];
  return {
    ...drafts,
    [key]: {
      classId: day.classId,
      date: day.date,
      label: day.label,
      marks: { ...before?.marks, [studentId]: status },
      baseVersion: before ? before.baseVersion : day.baseVersion,
      state: "unsaved",
      updatedAt: now,
    },
  };
}

/** OFFLINE-2: "Guardar" pressed: these marks are to be sent. */
export function markPending(drafts: Drafts, day: Day, marks: Marks, now: number): Drafts {
  const key = draftKey(day.classId, day.date);
  const before = drafts[key];
  return {
    ...drafts,
    [key]: {
      classId: day.classId,
      date: day.date,
      label: day.label,
      marks: { ...before?.marks, ...marks },
      baseVersion: before ? before.baseVersion : day.baseVersion,
      state: "pending",
      updatedAt: now,
    },
  };
}

export type SendResult =
  | { ok: true }
  | { ok: false; error: "conflict"; current: { held: boolean; marks: Marks } }
  | { ok: false; error: string };

/**
 * OFFLINE-3, OFFLINE-4: what the server answered for the draft sent at
 * `sentAt`. Saved, it leaves the phone; clashing or refused, it stays to be
 * dealt with. A draft changed while it travelled is newer than the answer and
 * is left as it is.
 */
export function settle(drafts: Drafts, key: string, sentAt: number, result: SendResult): Drafts {
  const draft = drafts[key];
  if (!draft || draft.updatedAt !== sentAt) return drafts;
  if (result.ok) {
    const rest = { ...drafts };
    delete rest[key];
    return rest;
  }
  if ("current" in result) return { ...drafts, [key]: { ...draft, state: "conflict", current: result.current } };
  return { ...drafts, [key]: { ...draft, state: "failed", error: result.error } };
}

export function discard(drafts: Drafts, key: string): Drafts {
  const rest = { ...drafts };
  delete rest[key];
  return rest;
}

/** OFFLINE-4: what waits to be sent, oldest day first. */
export function pendingDrafts(drafts: Drafts): [string, Draft][] {
  return Object.entries(drafts)
    .filter(([, d]) => d.state === "pending")
    .sort(([, a], [, b]) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt);
}

/** OFFLINE-4: what needs the teacher: days that clashed or were refused. */
export function needsAttention(drafts: Drafts): [string, Draft][] {
  return Object.entries(drafts)
    .filter(([, d]) => d.state === "conflict" || d.state === "failed")
    .sort(([, a], [, b]) => a.date.localeCompare(b.date));
}

/** OFFLINE-3: how many students differ between the phone's copy and the day as saved now. */
export function differences(mine: Marks, current: Marks): number {
  return Object.entries(mine).filter(([studentId, status]) => current[studentId] !== status).length;
}
