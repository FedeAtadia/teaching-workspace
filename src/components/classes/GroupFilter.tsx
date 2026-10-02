import Link from "next/link";

/**
 * GROUP-6: "Todos" and one pill per group. The choice lives in the address
 * (`?group=<id>`), so it survives a reload and can be bookmarked.
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
  const pill =
    "flex h-9 items-center rounded-full bg-muted px-3.5 text-sm font-bold text-muted-foreground hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground";
  return (
    <nav className="mb-4 flex flex-wrap gap-2">
      <Link href={href()} aria-current={!current ? "page" : undefined} className={pill}>
        {allLabel}
      </Link>
      {groups.map((g) => (
        <Link key={g.id} href={href(g.id)} aria-current={current === g.id ? "page" : undefined} className={pill}>
          {g.name}
        </Link>
      ))}
    </nav>
  );
}
