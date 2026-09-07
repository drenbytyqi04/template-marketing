import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { BrandIntro } from "@/components/marketing/BrandIntro";
import { ScrollStory } from "@/components/marketing/ScrollStory";
import { MiniDemo } from "@/components/marketing/MiniDemo";
import { TemplateShowcase } from "@/components/marketing/TemplateShowcase";
import { demoPosts } from "@/lib/rafty/demo";
import { usePrefersReducedMotion } from "@/components/marketing/usePrefersReducedMotion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "krijo24 | Branded posts, created in minutes" },
      {
        name: "description",
        content:
          "krijo24 helps any business create professional branded content quickly and consistently. Pick a template, add your details, generate a post and save it in seconds.",
      },
      { property: "og:title", content: "krijo24 | Branded posts, created in minutes" },
      {
        property: "og:description",
        content:
          "Create professional branded content quickly and consistently, no design skills required.",
      },
      { property: "og:url", content: "https://krijo24.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://krijo24.com/" }],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <BrandIntro />
      <MarketingLayout>
        <Hero />
        <TryItDemo />
        <TemplateShowcaseSection />
        <ScrollStory />
        <Principles />
        <FinalCta />
      </MarketingLayout>
    </>
  );
}

function Hero() {
  const reduced = usePrefersReducedMotion();
  const hero = demoPosts[0]!;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.85fr)]">
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Every post,
            <br />
            on brand.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            One image, a few details, a finished post. krijo24 turns what your business already has
            into content worth sharing.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-6">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/auth">
                Try for free
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Link
              to="/how-it-works"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              See how it works
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="mx-auto w-full max-w-sm"
          initial={{ opacity: 0, y: reduced ? 0 : 28, rotate: reduced ? 0 : -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          {...(reduced ? {} : { whileHover: { rotate: 1, scale: 1.01 } })}
        >
          <PostCanvas
            template={hero.template}
            content={hero.content}
            brand={hero.brand}
            businessName={hero.businessName}
            businessType={hero.businessType}
            className="rounded-2xl shadow-lift"
          />
        </motion.div>
      </div>
    </section>
  );
}

function TryItDemo() {
  const reduced = usePrefersReducedMotion();
  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <motion.div
        className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10"
        initial={{ opacity: 0, y: reduced ? 0 : 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Try it yourself
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Swap the photo, change the headline, pick a color. No account needed.
        </p>
        <div className="mt-8">
          <MiniDemo />
        </div>
      </motion.div>
    </section>
  );
}

function TemplateShowcaseSection() {
  const reduced = usePrefersReducedMotion();
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <motion.h2
        className="mx-auto max-w-xl text-center font-display text-3xl font-bold tracking-tight sm:text-4xl"
        initial={{ opacity: 0, y: reduced ? 0 : 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
      >
        Templates for how your business actually sells.
      </motion.h2>
      <div className="mt-10">
        <TemplateShowcase />
      </div>
    </section>
  );
}

const PRINCIPLES = [
  {
    n: "01",
    title: "Pick a template",
    body: "Layouts already tuned to how your kind of business sells.",
  },
  {
    n: "02",
    title: "Add your details",
    body: "A photo, a headline, a price or a date. Whatever the post needs.",
  },
  {
    n: "03",
    title: "Generate and adjust",
    body: "krijo24 writes the caption and lays it out. Tweak anything that is not quite right.",
  },
  {
    n: "04",
    title: "Save, download or share",
    body: "Keep it in your account, download the file, or share it straight to your device.",
  },
];

function Principles() {
  const reduced = usePrefersReducedMotion();
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
      <motion.h2
        className="max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl"
        initial={{ opacity: 0, y: reduced ? 0 : 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
      >
        Four steps. No design skills required.
      </motion.h2>

      <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2">
        {PRINCIPLES.map((p, i) => (
          <motion.div
            key={p.n}
            className="border-t border-border pt-5"
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: reduced ? 0 : i * 0.06 }}
          >
            <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
              {p.n}
            </span>
            <h3 className="mt-2 font-display text-xl font-bold">{p.title}</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{p.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  const reduced = usePrefersReducedMotion();
  return (
    <section className="mx-auto max-w-4xl px-4 pb-28 pt-6 text-center sm:px-6">
      <motion.h2
        className="font-display text-4xl font-bold tracking-tight sm:text-5xl"
        initial={{ opacity: 0, y: reduced ? 0 : 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
      >
        Your next post is one image away.
      </motion.h2>
      <div className="mt-8">
        <Button asChild size="lg" className="rounded-full px-8">
          <Link to="/auth">
            Try for free
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
