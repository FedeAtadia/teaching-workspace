"use client";

import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/**
 * REPORT-3, REPORT-4: what the report includes and the button that prints
 * it. The choices live in the address, so the report can be reloaded or
 * bookmarked as chosen. Not printed.
 */
export function ReportControls({
  studentId,
  courseId,
  courses,
  tasks,
  adaptations,
  labels,
}: {
  studentId: string;
  courseId: string;
  courses: { id: string; label: string }[];
  tasks: boolean;
  adaptations: boolean;
  labels: { course: string; tasks: string; adaptations: string; print: string; printHint: string };
}) {
  const router = useRouter();
  const go = (next: { courseId?: string; tasks?: boolean; adaptations?: boolean }) => {
    const params = new URLSearchParams({ course: next.courseId ?? courseId });
    if (next.tasks ?? tasks) params.set("tasks", "1");
    if (next.adaptations ?? adaptations) params.set("adaptations", "1");
    router.replace(`/students/${studentId}/report?${params}`, { scroll: false });
  };

  return (
    <div className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {courses.length > 1 && (
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {labels.course}
            <NativeSelect value={courseId} onChange={(e) => go({ courseId: e.target.value })} className="font-normal">
              {courses.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tasks}
            onChange={(e) => go({ tasks: e.target.checked })}
            className="size-4 accent-primary"
          />
          {labels.tasks}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={adaptations}
            onChange={(e) => go({ adaptations: e.target.checked })}
            className="size-4 accent-primary"
          />
          {labels.adaptations}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" onClick={() => window.print()}>
          <Printer aria-hidden />
          {labels.print}
        </Button>
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">{labels.printHint}</p>
      </div>
    </div>
  );
}
