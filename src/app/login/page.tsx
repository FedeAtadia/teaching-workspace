import { getTranslations } from "next-intl/server";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Logo } from "@/components/Logo";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("login");
  const tApp = await getTranslations("app");
  const { error } = await searchParams;
  return (
    // THEME-4: nobody has chosen a theme here, so the official Teal nórdico, whatever this device picked.
    <main data-palette="teal" className="flex flex-1 items-center justify-center bg-background p-6 text-foreground">
      <div className="grid w-full max-w-sm justify-items-center gap-6 rounded-3xl bg-card px-8 py-10 text-center ring-1 ring-border shadow-[0_12px_40px_rgb(27_31_42/0.12)]">
        <Logo name={tApp("name")} size="lg" />
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <GoogleSignInButton label={t("google")} />
        {error && (
          <p role="alert" className="w-full rounded-xl bg-alert-soft px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20">
            {t("error")}
          </p>
        )}
      </div>
    </main>
  );
}
