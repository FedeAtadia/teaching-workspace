import { cn } from "cn";
import type { AttendanceCell } from "@/lib/attendance";

/**
 * One attendance mark as a small rounded square: P in the accent tint, A in
 * red, T outlined (it counts half), J grey (it doesn't count). "·" is a day
 * the student doesn't come (ATT-1). Texts arrive in the teacher's language.
 */
export function AttendanceMark({
  cell,
  short,
  title,
  className,
}: {
  cell: AttendanceCell;
  /** "P", "A", "T", "J" or "·". */
  short: string;
  /** "Presente", … read on hover and by screen readers. */
  title: string;
  className?: string;
}) {
  if (cell === null) return null;
  return (
    <abbr
      title={title}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold no-underline",
        cell === "present" && "bg-highlight-soft text-highlight",
        cell === "absent" && "bg-alert-soft text-destructive",
        cell === "late" && "text-highlight ring-1 ring-highlight/60 ring-inset",
        cell === "excused" && "bg-muted text-muted-foreground",
        cell === "notExpected" && "text-muted-foreground/60",
        className,
      )}
    >
      {short}
    </abbr>
  );
}
