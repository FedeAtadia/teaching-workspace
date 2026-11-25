import { describe, expect, it } from "vitest";
import {
  differences,
  discard,
  draftKey,
  markPending,
  needsAttention,
  pendingDrafts,
  readDrafts,
  recordMark,
  settle,
  storageKey,
  writeDrafts,
  type Drafts,
  type KeyValueStore,
} from "./offlineAttendance";

/** The browser's localStorage, in memory. */
function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const day = { classId: "c1", date: "2026-11-13", label: "5° A Matemática · Viernes 13/11", baseVersion: null };
const key = draftKey(day.classId, day.date);

describe("attendance kept on the phone (OFFLINE)", () => {
  it("keeps each mark the moment it is tapped, as not yet saved (OFFLINE-2)", () => {
    let drafts: Drafts = {};
    drafts = recordMark(drafts, day, "ana", "absent", 1);
    drafts = recordMark(drafts, day, "bea", "late", 2);
    expect(drafts[key]).toMatchObject({ marks: { ana: "absent", bea: "late" }, state: "unsaved", baseVersion: null, updatedAt: 2 });
    // Unsaved marks are only brought back into the form, never sent on their own.
    expect(pendingDrafts(drafts)).toEqual([]);
  });

  it("queues the day when Guardar is pressed, and keeps the version it was taken from (OFFLINE-2, OFFLINE-3)", () => {
    let drafts = recordMark({}, { ...day, baseVersion: 4 }, "ana", "absent", 1);
    // The page reloaded meanwhile shows version 5, but the marks were taken from 4.
    drafts = markPending(drafts, { ...day, baseVersion: 5 }, { ana: "absent", bea: "present" }, 3);
    expect(drafts[key]).toMatchObject({ state: "pending", baseVersion: 4, marks: { ana: "absent", bea: "present" } });
    expect(pendingDrafts(drafts).map(([k]) => k)).toEqual([key]);

    // Tapping again after Guardar makes it unsaved until saved again.
    drafts = recordMark(drafts, day, "bea", "late", 4);
    expect(drafts[key].state).toBe("unsaved");
  });

  it("leaves the phone once saved, unless it changed while travelling (OFFLINE-4)", () => {
    const sent = markPending({}, day, { ana: "present" }, 10);
    expect(settle(sent, key, 10, { ok: true })).toEqual({});

    const changedMeanwhile = recordMark(sent, day, "ana", "late", 11);
    expect(settle(changedMeanwhile, key, 10, { ok: true })[key]).toMatchObject({ marks: { ana: "late" }, state: "unsaved" });
  });

  it("stays, with the day as saved now, when it clashes (OFFLINE-3)", () => {
    const sent = markPending({}, day, { ana: "absent", bea: "present" }, 10);
    const result = { ok: false as const, error: "conflict" as const, current: { held: true, marks: { ana: "present", bea: "present" } } };
    const after = settle(sent, key, 10, result);
    expect(after[key]).toMatchObject({ state: "conflict", current: result.current });
    expect(pendingDrafts(after)).toEqual([]);
    expect(needsAttention(after).map(([k]) => k)).toEqual([key]);
    expect(differences(after[key].marks, after[key].current!.marks)).toBe(1);
    expect(discard(after, key)).toEqual({});
  });

  it("stays as refused when the server says no for good (OFFLINE-4)", () => {
    const after = settle(markPending({}, day, { ana: "present" }, 10), key, 10, { ok: false, error: "notFound" });
    expect(after[key]).toMatchObject({ state: "failed", error: "notFound" });
    expect(needsAttention(after)).toHaveLength(1);
  });

  it("sends the oldest day first (OFFLINE-4)", () => {
    let drafts = markPending({}, { ...day, date: "2026-11-13" }, { ana: "present" }, 1);
    drafts = markPending(drafts, { ...day, date: "2026-11-10" }, { ana: "present" }, 2);
    expect(pendingDrafts(drafts).map(([, d]) => d.date)).toEqual(["2026-11-10", "2026-11-13"]);
  });

  it("keeps each teacher's drafts apart on the same phone, and survives anything unreadable (OFFLINE-2)", () => {
    const store = memoryStore();
    const drafts = markPending({}, day, { ana: "present" }, 1);
    writeDrafts(store, "teacher-a", drafts);
    expect(readDrafts(store, "teacher-a")).toEqual(drafts);
    expect(readDrafts(store, "teacher-b")).toEqual({});

    // Nothing left: the key goes too.
    writeDrafts(store, "teacher-a", {});
    expect(store.data.has(storageKey("teacher-a"))).toBe(false);

    store.setItem(storageKey("teacher-a"), "not json");
    expect(readDrafts(store, "teacher-a")).toEqual({});
    store.setItem(
      storageKey("teacher-a"),
      JSON.stringify({ good: drafts[key], bad: { ...drafts[key], marks: { ana: "maybe" } }, worse: 3 }),
    );
    expect(Object.keys(readDrafts(store, "teacher-a"))).toEqual(["good"]);
  });
});
