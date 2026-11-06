import { Skeleton, SkeletonCard } from "@/components/Skeleton";

// Shown the moment a link is clicked, while the next page loads on the
// server. Without it the old page stays up with no sign anything happened.
// Shaped like Inicio: a heading, the figure tiles, then two columns of cards.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="grid gap-8 sm:gap-10">
      <div className="grid gap-3">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} className="hidden sm:grid" />
      </div>
    </div>
  );
}
