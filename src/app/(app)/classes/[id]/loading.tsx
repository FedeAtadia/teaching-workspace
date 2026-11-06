import { Skeleton, SkeletonRows } from "@/components/Skeleton";

// Switching tabs inside a class: the header and tabs stay, only this part
// waits. Shaped like a tab: a row of controls, then the students' list.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-64 max-w-full rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <SkeletonRows rows={6} />
    </div>
  );
}
