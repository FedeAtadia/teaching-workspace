import Link from "next/link";

/**
 * GROUP-6: "Todos" and one chip per group, as a segmented control. The choice
 * lives in the address (`?group=<id>`), so it survives a reload and can be bookmarked.
 */
export function GroupFilter({
  groups,
  current,
  href,
  allLabel,
}: {
  groups: { id: string; name: string }[];
  current: string | undefined;
  /** The page's address for a group, or for all of them. */
  href: (groupId?: string) => string;
  allLabel: string;
}) {
  if (groups.length === 0) return null;
  const chip =
    "flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm";
  return (
    <nav className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-muted p-1 ring-1 ring-border">
      <Link href={href()} aria-current={!current ? "page" : undefined} className={chip}>
        {allLabel}
      </Link>
      {groups.map((g) => (
        <Link key={g.id} href={href(g.id)} aria-current={current === g.id ? "page" : undefined} className={chip}>
          {g.name}
        </Link>
      ))}
    </nav>
  );
}
