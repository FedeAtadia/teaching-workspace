import { cn } from "cn";

/** A grey placeholder block shown while a page loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Placeholder rows for a list or table: a card with a header strip, then one row per student. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
      <div className="flex items-center justify-between gap-4 border-b bg-muted/60 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-0 sm:px-5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className={cn("h-3.5", i % 2 === 0 ? "w-40" : "w-32")} />
          <Skeleton className="ml-auto h-8 w-20 rounded-full sm:w-36" />
        </div>
      ))}
    </div>
  );
}

/** A placeholder card: a title, then a few lines of text. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("grid content-start gap-4 rounded-2xl bg-card p-5 ring-1 ring-border", className)}>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="grid gap-2 border-t pt-4">
          <Skeleton className={cn("h-3.5", i % 2 === 0 ? "w-2/3" : "w-1/2")} />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
