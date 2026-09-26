import { AppShell } from "@/components/AppShell";

// Everything behind sign-in lives in this route group.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
