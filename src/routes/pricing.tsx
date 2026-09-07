import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePrefersReducedMotion } from "@/components/marketing/usePrefersReducedMotion";
import { annualPerMonth, PLANS } from "@/lib/rafty/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "krijo24 pricing | Simple plans for branded content" },
      {
        name: "description",
        content:
          "Three straightforward krijo24 plans built around brands and templates, from 50 euro per month. Annual billing saves 20 percent. Checkout is not live yet, every plan starts a conversation.",
      },
      { property: "og:title", content: "krijo24 pricing | Simple plans for branded content" },
      {
        property: "og:description",
        content: "Three plans, clear features, no payment surprises.",
      },
      { property: "og:url", content: "https://krijo24.com/pricing" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://krijo24.com/pricing" }],
  }),
  component: PricingPage,
});

function euro(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)} \u20ac`;
}

function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const reduced = usePrefersReducedMotion();

  return (
    <MarketingLayout>
      <section className="mx-auto max-w-3xl px-4 pb-8 pt-16 text-center sm:px-6 sm:pt-24">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Simple pricing, no surprises
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Three plans, built around how many brands you manage. Every plan includes unlimited
          templates and the ability to build your own.
        </p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border px-4 py-2">
          <span
            className={cn(
              "text-sm font-medium",
              !annual && "text-foreground",
              annual && "text-muted-foreground",
            )}
          >
            Monthly
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Toggle annual pricing" />
          <span
            className={cn(
              "text-sm font-medium",
              annual && "text-foreground",
              !annual && "text-muted-foreground",
            )}
          >
            Annual
          </span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
            Save 20%
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
          {PLANS.map((plan, i) => {
            const isPartnership = plan.tier === "partnership";
            const effective = annual ? annualPerMonth(plan.monthly) : plan.monthly;
            return (
              <motion.div
                key={plan.tier}
                className={cn(
                  "flex flex-col gap-6 bg-background p-8",
                  isPartnership && "bg-foreground text-background",
                )}
                initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: reduced ? 0 : i * 0.06 }}
              >
                <div>
                  {isPartnership ? (
                    <span className="mb-2 inline-block rounded-full border border-background/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      krijo24 Partnership
                    </span>
                  ) : null}
                  <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      isPartnership ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {plan.brands} brand{plan.brands > 1 ? "s" : ""}
                  </p>
                </div>

                <div>
                  <span className="font-display text-4xl font-bold">{euro(effective)}</span>
                  <span
                    className={cn(
                      "text-sm",
                      isPartnership ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {" "}
                    / month
                  </span>
                  {annual ? (
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        isPartnership ? "text-background/60" : "text-muted-foreground",
                      )}
                    >
                      Billed annually
                    </p>
                  ) : null}
                </div>

                <ul className="flex flex-1 flex-col gap-2.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isPartnership ? (
                  <p className="text-xs text-background/70">
                    krijo24 creates up to {plan.partnershipPosts} posts a month from the pictures
                    and information you send us, alongside the unlimited posts you can still make
                    yourself.
                  </p>
                ) : null}

                <Button
                  asChild
                  size="lg"
                  variant={isPartnership ? "secondary" : "outline"}
                  className="rounded-full"
                >
                  <Link to="/contact">Talk to us about {plan.name}</Link>
                </Button>
              </motion.div>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-lg text-center text-sm text-muted-foreground">
          Online checkout is not live yet. Choosing a plan starts a conversation with us, it does
          not charge you anything.
        </p>
      </section>
    </MarketingLayout>
  );
}
