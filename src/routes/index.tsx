import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Film,
  Globe,
  Layers,
  MessagesSquare,
  Move,
  Palette,
  PenLine,
  Wand2,
} from "lucide-react";
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
          "Branded posts, stories, carousels and clips for your business. Pick a template, add your details and krijo24 lays it out in your colours, writes the caption and hands you the finished file.",
      },
      { property: "og:title", content: "krijo24 | Branded posts, created in minutes" },
      {
        property: "og:description",
        content:
          "Posts, stories, carousels and clips in your brand, laid out for you. No design skills required.",
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
        <Capabilities />
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
          {/* What it costs to find out, which is the question standing between
              somebody reading this and pressing the button above. */}
          <p className="mt-5 text-sm text-muted-foreground">
            No card needed. Your first post is free.
          </p>
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

/**
 * What the product actually does, said once, in its own words.
 *
 * The page had the promise and the proof - a hero, a live demo, a scroll
 * through finished posts - and nothing in between that named a single
 * capability. Somebody deciding whether this replaces their designer could not
 * find out from the home page whether it made stories, whether it touched
 * their logo, or what happened after they pressed Generate.
 *
 * Every line here is a feature that works today. The two that do not are named
 * underneath as not working yet, because a landing page that quietly lists
 * something unreleased among things that ship is how a trial ends in a support
 * request.
 */
const CAPABILITIES = [
  {
    icon: Layers,
    title: "Templates built around your trade",
    body: "Layouts tuned to how a travel agency, a restaurant or a dealership actually sells. Send us your own design and it becomes a template only your account can use.",
  },
  {
    icon: Palette,
    title: "Your brand, applied for you",
    body: "Logo, colours, typeface, phone number and address are set once. Every post after that comes out in them, in your currency and your language.",
  },
  {
    icon: Wand2,
    title: "Your logo, cleaned up on the way in",
    body: "The white box around it is removed automatically, so the mark sits on the design instead of a square. Recolour it for a single post without touching the file you uploaded.",
  },
  {
    icon: Move,
    title: "Move anything, and watch it move",
    body: "Headline, price, terms, logo - lift any of them out of the layout and place it yourself, with the live preview beside the form the whole time.",
  },
  {
    icon: PenLine,
    title: "The caption is written for you",
    body: "In the language your brand is set to, from the details you already typed. Edit it or ask for another one.",
  },
  {
    icon: Film,
    title: "Feed posts, stories, carousels and clips",
    body: "One set of details, any shape. Download a finished file with your typefaces embedded, ready to post anywhere.",
  },
  {
    icon: Globe,
    title: "Your own website, turned into posts",
    body: "Point krijo24 at the page where your offers live. It reads them and lays each one out as a finished design you can download.",
  },
  {
    icon: MessagesSquare,
    title: "A real person to ask",
    body: "Open a request inside your account - plan, templates, anything - and follow its status until it is resolved.",
  },
];

function Capabilities() {
  const reduced = usePrefersReducedMotion();
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <motion.div
        className="max-w-2xl"
        initial={{ opacity: 0, y: reduced ? 0 : 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Everything a small marketing team does, without the team.
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Not a drag-and-drop canvas with your logo dropped on top. krijo24 knows what a post is for
          and lays it out accordingly.
        </p>
      </motion.div>

      <div className="mt-14 grid gap-x-10 gap-y-11 sm:grid-cols-2 lg:grid-cols-4">
        {CAPABILITIES.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: reduced ? 0 : (i % 4) * 0.06 }}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
              <c.icon className="size-5 text-accent-foreground" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold leading-snug">{c.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
          </motion.div>
        ))}
      </div>

      <motion.p
        className="mt-14 border-t border-border pt-5 text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <span className="font-semibold text-foreground">Coming in 2.0:</span> scheduling a post for
        a date, and publishing straight to Instagram. Everything above works today.
      </motion.p>
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
    body: "krijo24 lays it out and writes the caption, with the preview beside you as you change things.",
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
      <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground">
        Make one, free, and see what it looks like in your own colours.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
        <Button asChild size="lg" className="rounded-full px-8">
          <Link to="/auth">
            Try for free
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
        <Link
          to="/pricing"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          See pricing
        </Link>
      </div>
    </section>
  );
}
