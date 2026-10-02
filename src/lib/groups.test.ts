import { describe, expect, it } from "vitest";
import { groupTaskDate, isAssessed } from "./groups";

describe("who is assessed on a task (GROUP-3)", () => {
  it("is everyone when the task lists no groups, with a group or without", () => {
    expect(isAssessed([], "lunes")).toBe(true);
    expect(isAssessed([], null)).toBe(true);
  });

  it("is only the listed groups' students otherwise; no group means not assessed", () => {
    expect(isAssessed(["lunes", "martes"], "martes")).toBe(true);
    expect(isAssessed(["lunes"], "martes")).toBe(false);
    expect(isAssessed(["lunes"], null)).toBe(false);
  });
});

describe("a group task's date (GROUP-3, TASK-3)", () => {
  it("is the earliest of its groups' dates, or the task's own date without groups", () => {
    expect(groupTaskDate([{ dueOn: "2026-05-12" }, { dueOn: "2026-05-10" }, { dueOn: null }], "2026-01-01")).toBe(
      "2026-05-10",
    );
    expect(groupTaskDate([], "2026-04-01")).toBe("2026-04-01");
    expect(groupTaskDate([{ dueOn: null }], "2026-04-01")).toBeNull();
  });
});
