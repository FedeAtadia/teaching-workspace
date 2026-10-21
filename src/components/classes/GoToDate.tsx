"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateField } from "@/components/forms/DateField";

/** ATT-1: open any date of the school year, e.g. for a make-up class. */
export function GoToDate({
  basePath,
  query,
  min,
  max,
  initial,
  label,
  go,
}: {
  /** The class's attendance path; the date is appended. */
  basePath: string;
  /** Kept on the address, e.g. "?group=…". */
  query: string;
  min: string;
  max: string;
  initial: string;
  label: string;
  go: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initial);
  return (
    <form
      className="mt-6 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (date) router.push(`${basePath}/${date}${query}`);
      }}
    >
      <div className="grid gap-1.5">
        <label htmlFor="go-to-date" className="text-sm font-bold">
          {label}
        </label>
        <DateField id="go-to-date" defaultValue={initial} min={min} max={max} onChange={(iso) => setDate(iso ?? "")} />
      </div>
      <button
        type="submit"
        className="h-9 rounded-full bg-muted px-4 text-sm font-bold text-muted-foreground hover:text-foreground"
      >
        {go}
      </button>
    </form>
  );
}
