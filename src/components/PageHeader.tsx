import type { ReactNode } from "react";

/** A page's title, its main button on the right, and the page body. */
export function PageHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {action}
      </div>
      {children}
    </>
  );
}
