import { getTranslations } from "next-intl/server";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("login");
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-black/10 p-8 dark:border-white/15">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {error && <p className="text-sm text-red-600">{t("error")}</p>}
        <GoogleSignInButton label={t("google")} />
      </div>
    </main>
  );
}
