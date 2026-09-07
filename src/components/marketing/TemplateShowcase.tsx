import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PostCanvas } from "@/components/rafty/PostCanvas";
import { demoPosts } from "@/lib/rafty/demo";
import { usePrefersReducedMotion } from "@/components/marketing/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 1000;

/**
 * Auto-advancing template carousel. The active template is sharp and
 * centered, neighbors are scaled down, faded and blurred at the edges.
 * Pauses on hover and when the visitor prefers reduced motion.
 */
export function TemplateShowcase() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const count = demoPosts.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduced || hovered) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reduced, hovered, count]);

  const positionOf = (i: number) => {
    const diff = (i - index + count) % count;
    if (diff === 0) return "active" as const;
    if (diff === 1) return "next" as const;
    return "prev" as const;
  };

  return (
    <div
      className="relative mx-auto flex h-[380px] w-full max-w-3xl items-center justify-center overflow-hidden sm:h-[440px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence initial={false}>
        {demoPosts.map((post, i) => {
          const position = positionOf(i);
          if (position !== "active" && count <= 2) return null;

          const styleByPosition = {
            active: { x: "0%", scale: 1, opacity: 1, filter: "blur(0px)", zIndex: 3 },
            next: { x: "62%", scale: 0.8, opacity: 0.35, filter: "blur(2px)", zIndex: 1 },
            prev: { x: "-62%", scale: 0.8, opacity: 0.35, filter: "blur(2px)", zIndex: 1 },
          } as const;

          return (
            <motion.div
              key={post.businessName}
              className="absolute w-[220px] sm:w-[260px]"
              initial={false}
              animate={styleByPosition[position]}
              transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ pointerEvents: position === "active" ? "auto" : "none" }}
            >
              <PostCanvas
                template={post.template}
                content={post.content}
                brand={post.brand}
                businessName={post.businessName}
                businessType={post.businessType}
                className={cn(
                  "rounded-2xl shadow-xl",
                  position === "active" ? "ring-1 ring-border" : "",
                )}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent sm:w-28" />
    </div>
  );
}
