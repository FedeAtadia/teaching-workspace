import { SkeletonRows } from "@/components/Skeleton";

// Switching tabs inside a class: the header and tabs stay, only this part waits.
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonRows rows={4} />
    </div>
  );
}
