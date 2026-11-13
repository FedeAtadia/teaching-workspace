// Pages made to be printed: behind sign-in like the rest of the app (the
// proxy and each page check it), but without the menu around them.
export default function PrintLayout({ children }: LayoutProps<"/">) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8 print:max-w-none print:p-0">{children}</main>;
}
