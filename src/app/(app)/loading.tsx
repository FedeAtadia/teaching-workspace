import { Skeleton, SkeletonRows } from "@/components/Skeleton";

// Shown the moment a link is clicked, while the next page loads on the
// server. Without it the old page stays up with no sign anything happened.
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <SkeletonRows />
    </div>
  );
}
