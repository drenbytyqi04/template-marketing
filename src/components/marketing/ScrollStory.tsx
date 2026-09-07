import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { demoPosts } from "@/lib/rafty/demo";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const STAGES = [
  {
    eyebrow: "Start with what you have",
    headline: "One photo. A few details.",
    body: "Drop in a single image and the basics of your offer. krijo24 takes it from there.",
  },
  {
    eyebrow: "Pick a look",
    headline: "A template that already fits.",
    body: "Layouts tuned to how your business actually sells, ready in one click.",
  },
  {
    eyebrow: "Make it yours",
    headline: "Your colors. Your voice.",
    body: "Type, logo and palette fall into place, then the caption writes itself.",
  },
];

/**
 * Scroll driven product story. Pins the viewport for the length of the
 * section and steps through demo posts as the user scrolls, so the visual
 * narrates: image in, template chosen, brand applied, post finished.
 */
export function ScrollStory() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const [stage, setStage] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(STAGES.length - 1, Math.floor(value * STAGES.length));
    setStage(next);
  });

  const post = demoPosts[stage] ?? demoPosts[0]!;
  const copy = STAGES[stage]!;

  if (reduced) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="mx-auto w-full max-w-sm">
            <PostCanvas
              template={post.template}
              content={post.content}
              brand={post.brand}
              businessName={post.businessName}
              businessType={post.businessType}
              className="rounded-2xl shadow-lift"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {copy.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.headline}
            </h2>
            <p className="mt-4 max-w-md text-base text-muted-foreground">{copy.body}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {copy.eyebrow}
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                  {copy.headline}
                </h2>
                <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
                  {copy.body}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-10 flex items-center gap-2">
              {STAGES.map((s, i) => (
                <span
                  key={s.headline}
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: i === stage ? 28 : 10,
                    backgroundColor: i === stage ? "var(--foreground)" : "var(--border)",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <PostCanvas
                  template={post.template}
                  content={post.content}
                  brand={post.brand}
                  businessName={post.businessName}
                  businessType={post.businessType}
                  className="rounded-2xl shadow-lift"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
