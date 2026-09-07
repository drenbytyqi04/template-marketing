import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { globalTemplates } from "@/lib/rafty/templates";
import { demoPosts } from "@/lib/rafty/demo";
import type { TemplateTag } from "@/lib/rafty/types";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "krijo24 template gallery | A taste of the library" },
      {
        name: "description",
        content:
          "Browse a curated selection of krijo24's global templates grouped by visual family. There are many more inside the app.",
      },
      { property: "og:title", content: "krijo24 template gallery | A taste of the library" },
      {
        property: "og:description",
        content: "A curated look at krijo24's global template library, grouped by visual family.",
      },
      { property: "og:url", content: "https://krijo24.com/gallery" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://krijo24.com/gallery" }],
  }),
  component: GalleryPage,
});

const FAMILIES: { tag: TemplateTag; label: string }[] = [
  { tag: "editorial", label: "Editorial" },
  { tag: "minimal", label: "Minimal" },
  { tag: "bold", label: "Bold type" },
  { tag: "luxury", label: "Luxury" },
  { tag: "gradient", label: "Modern gradient" },
  { tag: "offer", label: "Offer led" },
];

function GalleryPage() {
  return (
    <MarketingLayout>
      <section className="mx-auto max-w-4xl px-4 pb-6 pt-14 text-center sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          A look inside the template library
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          krijo24 ships with 50 global templates built as visual families, not industry boxes. Here
          is a curated sample from a few of them.
        </p>
      </section>

      {FAMILIES.map((family, index) => {
        const templates = globalTemplates
          .filter((tpl) => tpl.tags.includes(family.tag))
          .slice(0, 3);
        const demo = demoPosts[index % demoPosts.length]!;

        return (
          <section key={family.tag} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-xl font-extrabold">{family.label}</h2>
              <span className="text-xs font-medium text-muted-foreground">
                {globalTemplates.filter((tpl) => tpl.tags.includes(family.tag)).length} templates in
                krijo24
              </span>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="card-soft overflow-hidden p-2">
                  <PostCanvas
                    template={tpl}
                    content={demo.content}
                    brand={demo.brand}
                    businessName={demo.businessName}
                    businessType={demo.businessType}
                    className="rounded-xl"
                  />
                  <p className="px-2 pb-1 pt-3 text-xs font-medium text-muted-foreground">
                    {tpl.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="brand-gradient flex flex-col items-start gap-4 rounded-3xl px-6 py-10 text-primary-foreground sm:px-10">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
            See all 50 templates, plus your own.
          </h2>
          <p className="max-w-xl text-sm text-primary-foreground/85">
            Once inside krijo24 you can browse the full library and even request a custom template
            built for your brand.
          </p>
          <Button asChild size="lg" variant="secondary" className="rounded-xl">
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
