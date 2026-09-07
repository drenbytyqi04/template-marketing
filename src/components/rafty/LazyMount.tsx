import { useEffect, useRef, useState } from "react";

/**
 * Renders its child only once it is close to the viewport. Used by every
 * thumbnail grid so a large library never renders a hundred live canvases at
 * the same time, which keeps Create and Templates responsive.
 */
export function LazyMount({
  children,
  ratio = "4 / 5",
  className,
}: {
  children: React.ReactNode;
  ratio?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={className ?? "w-full"}>
      {visible ? (
        children
      ) : (
        <div className="w-full rounded-lg bg-muted" style={{ aspectRatio: ratio }} />
      )}
    </div>
  );
}
