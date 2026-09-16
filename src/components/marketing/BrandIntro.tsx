import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/rafty/Logo";

const SESSION_KEY = "krijo24-intro-shown";
const HOLD_MS = 620;

/**
 * Quick, once-per-session brand intro shown before the marketing home
 * finishes revealing. Skipped entirely under reduced motion or on repeat
 * visits within the same session.
 *
 * Whether to show it is decided once, inside the effect, and the effect depends
 * on nothing. It used to take reduced motion from a hook that reports false on
 * the first render and the true answer a moment later. On a machine with
 * animation turned off that second answer re-ran the effect: the timer that
 * hides the intro was cleared on the way out, the re-run saw the session key it
 * had just written and returned early, and the intro stayed over the whole page
 * until the visitor reloaded. Hiding on the way out as well means no re-run,
 * remount or double invocation can stranded it there again.
 */
export function BrandIntro() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let held = 0;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // A browser that refuses storage still gets the intro, just every visit.
    }
    setVisible(true);
    held = window.setTimeout(() => setVisible(false), HOLD_MS);
    return () => {
      window.clearTimeout(held);
      setVisible(false);
    };
  }, []);

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
