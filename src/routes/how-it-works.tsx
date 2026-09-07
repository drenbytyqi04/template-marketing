import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Image, LayoutTemplate, Sparkles, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePrefersReducedMotion } from "@/components/marketing/usePrefersReducedMotion";
import { demoPosts } from "@/lib/rafty/demo";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How krijo24 works | From one image to a branded post" },
      {
        name: "description",
        content:
          "See the real four step flow: pick a template, add your details and one image, generate your post and caption, then adjust and save, download or share it.",
      },
      { property: "og:title", content: "How krijo24 works | From one image to a branded post" },
      {
        property: "og:description",
        content: "Four steps, one finished branded post. No design skills needed.",
      },
      { property: "og:url", content: "https://krijo24.com/how-it-works" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://krijo24.com/how-it-works" }],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    icon: LayoutTemplate,
    title: "Pick a template",
    body: "Choose from a curated library, tuned to how your kind of business sells.",
    postIndex: 1,
  },
  {
    icon: Image,
    title: "Add a few details and one image",
    body: "A headline, a price or a date, and a single photo. That is the whole brief.",
    postIndex: 0,
  },
  {
    icon: Sparkles,
    title: "Generate your post and caption",
    body: "krijo24 lays out your image and text in your brand colors, and writes a caption to match.",
    postIndex: 2,
  },
  {
    icon: Share2,
    title: "Adjust, then save, download or share",
    body: "Make any small change you like, then keep it in your account, download the file, or share it straight to your device.",
    postIndex: 1,
  },
];

function HowItWorksPage() {
  const reduced = usePrefersReducedMotion();

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-16 sm:px-6 sm:pt-24">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Four steps to your first post
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          No design software, no learning curve. Just the parts of the process that actually matter.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col gap-20 sm:gap-28">
          {STEPS.map((step, index) => {
            const post = demoPosts[step.postIndex]!;
            const reversed = index % 2 === 1;
            return (
              <motion.div
                key={step.title}
                className={`grid items-center gap-10 sm:grid-cols-2 ${reversed ? "sm:[&>*:first-child]:order-2" : ""}`}
                initial={{ opacity: 0, y: reduced ? 0 : 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div>
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-border text-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{step.title}</h2>
                  <p className="mt-3 max-w-sm text-base text-muted-foreground">{step.body}</p>
                </div>
                <div className="mx-auto w-full max-w-xs">
                  <PostCanvas
                    template={post.template}
                    content={post.content}
                    brand={post.brand}
                    businessName={post.businessName}
                    businessType={post.businessType}
                    className="rounded-2xl shadow-lift"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-28 text-center sm:px-6">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          That is the whole process.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
          No scheduling, no automated publishing. Just a fast way to make something worth posting
          yourself.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/auth">
              Try for free
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
}
