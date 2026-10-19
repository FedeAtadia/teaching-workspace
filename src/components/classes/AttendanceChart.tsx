/**
 * ATT-5: each student's attendance % as a bar, against the minimum
 * (SUGGEST-3). One series, so no legend: the title names it. A bar below the
 * minimum is also labelled, so it never relies on color alone. Hovering a row
 * shows its counts; the table above is the same data.
 */
export function AttendanceChart({
  title,
  rows,
  minimum,
  minimumLabel,
  emptyLabel,
  belowLabel,
}: {
  title: string;
  rows: { id: string; name: string; rate: number | null; below: boolean; detail: string }[];
  minimum: number;
  minimumLabel: string;
  emptyLabel: string;
  belowLabel: string;
}) {
  const withRate = rows.filter((r) => r.rate !== null);
  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="mb-1 font-extrabold">{title}</h2>
      {withRate.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          {minimum > 0 && (
            <div className="relative mb-1 ml-[min(40%,12rem)] h-4 text-[0.7rem] text-muted-foreground">
              <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${minimum}%` }}>
                {minimumLabel}
              </span>
            </div>
          )}
          <ul className="grid gap-1.5">
            {rows.map((r) => (
              <li key={r.id} title={`${r.name}: ${r.rate === null ? "—" : `${r.rate} %`} · ${r.detail}`}
                className="grid grid-cols-[min(40%,12rem)_1fr] items-center gap-3 rounded-md text-sm hover:bg-muted/60"
              >
                <span className="truncate">{r.name}</span>
                <div className="relative flex h-5 items-center">
                  {/* Recessive track and the minimum's reference line. */}
                  <div className="absolute inset-x-0 h-px bg-border" />
                  {minimum > 0 && (
                    <div className="absolute inset-y-0 border-l border-dashed border-muted-foreground/60" style={{ left: `${minimum}%` }} />
                  )}
                  {r.rate !== null && (
                    <>
                      <div
                        className={`relative h-2.5 rounded-r-[4px] ${r.below ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${Math.max(r.rate, 1)}%` }}
                      />
                      <span className="relative ml-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {r.rate} %{r.below && <span className="ml-1 font-bold text-foreground">· {belowLabel}</span>}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
