import { getTranslations } from "next-intl/server";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Logo } from "@/components/Logo";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("login");
  const tApp = await getTranslations("app");
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-card p-8 ring-1 ring-border shadow-[0_12px_40px_rgb(27_31_42/0.12)]">
        <Logo name={tApp("name")} size="lg" />
        <h1 className="text-xl font-bold">{t("title")}</h1>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("error")}
          </p>
        )}
        <GoogleSignInButton label={t("google")} />
      </div>
    </main>
  );
}
