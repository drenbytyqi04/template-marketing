import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { Logo } from "@/components/rafty/Logo";

const SESSION_KEY = "krijo24-intro-shown";

/**
 * Quick, once-per-session brand intro shown before the marketing home
 * finishes revealing. Skipped entirely under reduced motion or on repeat
 * visits within the same session.
 */
export function BrandIntro() {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reduced) return;
    const shown = window.sessionStorage.getItem(SESSION_KEY);
    if (shown) return;

    setVisible(true);
    window.sessionStorage.setItem(SESSION_KEY, "1");
    const timer = window.setTimeout(() => setVisible(false), 620);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="krijo24-intro"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Logo height={64} tone="light" />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
