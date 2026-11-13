"use client";

// OFFLINE-2..4: the phone's attendance drafts, shared by the day's form and
// the notice in the app's frame. The store is the browser's localStorage,
// which survives closing the app; every change is announced so each place
// showing the drafts redraws.

import { useCallback, useSyncExternalStore } from "react";
import { saveAttendanceAction } from "@/app/(app)/classes/[id]/attendance/actions";
import {
  discard,
  markPending,
  readDrafts,
  recordMark,
  settle,
  writeDrafts,
  type Draft,
  type Drafts,
  type Marks,
  type SendResult,
} from "@/lib/offlineAttendance";
import type { AttendanceStatus } from "@/lib/attendance";

const CHANGED = "annora:attendance-drafts";

/** localStorage, or nothing when the browser refuses it (a private window may). */
function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function load(teacherId: string): Drafts {
  const s = store();
  return s ? readDrafts(s, teacherId) : {};
}

function save(teacherId: string, change: (drafts: Drafts) => Drafts): void {
  const s = store();
  if (!s) return;
  try {
    writeDrafts(s, teacherId, change(readDrafts(s, teacherId)));
  } catch {
    // Storage full or blocked: the form still saves straight to the server.
  }
  window.dispatchEvent(new Event(CHANGED));
}

// useSyncExternalStore needs the same object back while nothing changed.
let cache: { teacherId: string; raw: string | null; drafts: Drafts } | null = null;
const EMPTY: Drafts = {};

function snapshot(teacherId: string): Drafts {
  const s = store();
  let raw: string | null = null;
  try {
    raw = s?.getItem(`annora.attendance.v1.${teacherId}`) ?? null;
  } catch {
    raw = null;
  }
  if (cache && cache.teacherId === teacherId && cache.raw === raw) return cache.drafts;
  cache = { teacherId, raw, drafts: load(teacherId) };
  return cache.drafts;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  // Another window of Annora on the same phone.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The teacher's drafts, redrawn whenever they change. Empty while rendering on the server. */
export function useDrafts(teacherId: string): Drafts {
  const get = useCallback(() => snapshot(teacherId), [teacherId]);
  return useSyncExternalStore(subscribe, get, () => EMPTY);
}

export type Day = { classId: string; date: string; label: string; baseVersion: number | null };

export function keepMark(teacherId: string, day: Day, studentId: string, status: AttendanceStatus): void {
  save(teacherId, (d) => recordMark(d, day, studentId, status, Date.now()));
}

export function forget(teacherId: string, key: string): void {
  save(teacherId, (d) => discard(d, key));
}

/** Sends in flight from this window, so the form and the notice never send the same day twice at once. */
const inFlight = new Map<string, Promise<SendResult>>();

/**
 * OFFLINE-2..4: queues the day's marks and sends them. Without signal the
 * call waits until it returns (OFFLINE-1); if the app closes first, the queue
 * is still on the phone and goes out next time.
 */
export function queueAndSend(teacherId: string, day: Day, marks: Marks): Promise<SendResult> {
  save(teacherId, (d) => markPending(d, day, marks, Date.now()));
  return send(teacherId, `${day.classId}:${day.date}`);
}

/** Sends one queued day, unless it is already on its way. `force` saves over a day changed elsewhere (OFFLINE-3). */
export function send(teacherId: string, key: string, options: { force?: boolean } = {}): Promise<SendResult> {
  const running = inFlight.get(key);
  if (running && !options.force) return running;

  const draft: Draft | undefined = load(teacherId)[key];
  if (!draft) return Promise.resolve({ ok: true });
  const sentAt = draft.updatedAt;
  const call = (async (): Promise<SendResult> => {
    try {
      const result = await saveAttendanceAction({
        classId: draft.classId,
        date: draft.date,
        marks: Object.entries(draft.marks).map(([studentId, status]) => ({ studentId, status })),
        baseVersion: draft.baseVersion,
        force: options.force,
      });
      save(teacherId, (d) => settle(d, key, sentAt, result));
      return result;
    } catch {
      // Not an answer from the server (the page left mid-way, say): it stays queued.
      return { ok: false, error: "network" };
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, call);
  return call;
}

/** OFFLINE-4: whether a day is on its way from this window. */
export const isSending = (key: string) => inFlight.has(key);
