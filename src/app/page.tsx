import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Faq } from "@/components/landing/Faq";
import { LandingNav } from "@/components/landing/LandingNav";
import { HomePreview, PhonePreview } from "@/components/landing/Previews";
import { Logo } from "@/components/Logo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  return { title: t("title"), description: t("description") };
}

type Pair = { before: string; after: string };
type Titled = { title: string; text: string };
type Group = { title: string; items: string[] };
type Question = { q: string; a: string };

const WIDE = "mx-auto max-w-[1180px] px-6";
const H2 = "font-heading text-[32px] leading-[1.1] font-bold tracking-[-0.8px] sm:text-[38px]";
const EYEBROW = "text-sm font-bold tracking-[1.5px] text-highlight uppercase";
const PRIMARY =
  "inline-flex h-13 items-center justify-center gap-2.5 rounded-[14px] bg-primary pr-5 pl-3.5 text-[17px] font-bold text-primary-foreground transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/**
 * The public home page (LAND-1): what Annora is and why, and the Google
 * sign-in. Signed-in teachers never see it; the proxy sends them to Inicio
 * (LAND-2). Always Teal nórdico, in light or dark (LAND-3).
 */
export default async function HomePage() {
  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");
  const pains = t.raw("pains.items") as Pair[];
  const steps = t.raw("how.steps") as Titled[];
  const groups = t.raw("features.groups") as Group[];
  const points = t.raw("data.points") as Titled[];
  const faq = t.raw("faq.items") as Question[];
  return (
    <div data-palette="teal" className="flex flex-1 flex-col bg-background text-[17px] leading-[1.55] text-foreground">
      <LandingNav name={tApp("name")} />

      <main id="top" className="scroll-mt-20">
        <section className={`${WIDE} flex flex-wrap items-center gap-12 pt-14 pb-14 sm:pt-[72px]`}>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-[22px]">
            <span className="self-start rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-highlight">
              {t("hero.badge")}
            </span>
            <h1 className="font-heading text-[clamp(40px,5.2vw,64px)] leading-[1.02] font-bold tracking-[-1.5px]">
              {t("hero.title")}
            </h1>
            <p className="max-w-[34em] text-[19px] text-muted-foreground">{t("hero.lead")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <GoogleSignInButton label={t("hero.signIn")} icon="tile" className={PRIMARY} />
              <a
                href="#como"
                className="inline-flex h-13 items-center rounded-[14px] border border-border bg-card px-5 font-semibold transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("hero.how")}
              </a>
            </div>
            <p className="text-sm text-muted-foreground">{t("hero.note")}</p>
          </div>
          <div className="min-w-0 flex-[1_1_440px]">
            <HomePreview />
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className={`${WIDE} flex flex-col gap-7 py-16`}>
            <div className="max-w-[640px]">
              <h2 className={`${H2} mb-2.5`}>{t("pains.title")}</h2>
              <p className="text-muted-foreground">{t("pains.lead")}</p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {pains.map((p) => (
                <article key={p.before} className="flex flex-col gap-2.5 rounded-[18px] bg-background p-[22px]">
                  <div className="text-[15px] text-muted-foreground line-through decoration-border">{p.before}</div>
                  <div className="flex items-start gap-2.5 font-semibold">
                    <Check aria-hidden strokeWidth={2.4} className="mt-[3px] size-5 shrink-0 text-highlight" />
                    <span>{p.after}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como" className={`${WIDE} flex scroll-mt-20 flex-col gap-8 py-20`}>
          <div className="max-w-[640px]">
            <span className={EYEBROW}>{t("how.eyebrow")}</span>
            <h2 className={`${H2} mt-2`}>{t("how.title")}</h2>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-[26px]">
                <span className="flex size-11 items-center justify-center rounded-[14px] bg-primary font-heading text-[22px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="font-heading text-[22px] font-bold">{s.title}</h3>
                <p className="text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="funciones" className="scroll-mt-20 bg-accent-deep text-white">
          <div className={`${WIDE} flex flex-col gap-9 py-20`}>
            <div className="max-w-[680px]">
              <span className="text-sm font-bold tracking-[1.5px] text-[#a8f0ec] uppercase">{t("features.eyebrow")}</span>
              <h2 className={`${H2} mt-2 mb-2.5`}>{t("features.title")}</h2>
              <p className="text-white/85">{t("features.lead")}</p>
            </div>
            {/* 4, 2 or 1 across: never three and one left alone. */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {groups.map((g) => (
                <article key={g.title} className="flex flex-col gap-3.5 rounded-[20px] border border-white/15 bg-white/[0.08] p-[26px]">
                  <h3 className="font-heading text-[22px] font-bold">{g.title}</h3>
                  <ul className="flex flex-col gap-2 text-base text-white/90">
                    {g.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#64dfdf]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${WIDE} flex flex-wrap items-center gap-12 py-20`}>
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
            <span className={EYEBROW}>{t("attendance.eyebrow")}</span>
            <h2 className={H2}>{t("attendance.title")}</h2>
            <p className="text-muted-foreground">{t("attendance.text1")}</p>
            <p className="text-muted-foreground">{t("attendance.text2")}</p>
          </div>
          <div className="flex min-w-0 flex-[1_1_360px] justify-center">
            <PhonePreview />
          </div>
        </section>

        <section id="datos" className="scroll-mt-20 border-t border-border bg-card">
          <div className={`${WIDE} flex flex-col gap-7 py-[72px]`}>
            <div className="max-w-[640px]">
              <span className={EYEBROW}>{t("data.eyebrow")}</span>
              <h2 className={`${H2} mt-2`}>{t("data.title")}</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
              {points.map((p) => (
                <article key={p.title} className="flex flex-col gap-2 rounded-[18px] bg-background p-6">
                  <h3 className="font-heading text-xl font-bold">{p.title}</h3>
                  <p className="text-base text-muted-foreground">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="preguntas" className="mx-auto flex w-full max-w-[820px] scroll-mt-20 flex-col gap-6 px-6 py-20">
          <h2 className={H2}>{t("faq.title")}</h2>
          <Faq items={faq} />
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto flex max-w-[1132px] flex-col items-center gap-[18px] rounded-[28px] bg-primary px-8 py-14 text-center text-primary-foreground">
            <h2 className="font-heading text-[clamp(30px,4vw,44px)] leading-[1.05] font-bold tracking-[-1px]">{t("band.title")}</h2>
            <p className="max-w-[36em] opacity-90">{t("band.text")}</p>
            <GoogleSignInButton
              label={t("hero.signIn")}
              icon="tile"
              className="inline-flex h-13 items-center gap-2.5 rounded-[14px] bg-card pr-[22px] pl-3.5 text-[17px] font-bold text-foreground transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-card focus-visible:ring-offset-2 focus-visible:ring-offset-primary focus-visible:outline-none"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${WIDE} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-7 text-sm text-muted-foreground`}>
          <span className="text-foreground">
            <Logo name={tApp("name")} />
          </span>
          <span>{t("footer.madeBy")}</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
