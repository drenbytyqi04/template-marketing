import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/rafty/Logo";

/**
 * Deliberately minimal. One row of links, one credit line, nothing else.
 * The agency credit carries a slow animated gradient so it reads as premium
 * rather than as an ad block.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" aria-label="krijo24 home">
            <Logo height={30} />
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/how-it-works" className="hover:text-foreground">
              How it works
            </Link>
            <Link to="/gallery" className="hover:text-foreground">
              Templates
            </Link>
            <Link to="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link to="/contact" className="hover:text-foreground">
              Book a demo
            </Link>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Anexio Group LLC. All rights reserved.</p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <a
              href="https://webdoagency.com"
              target="_blank"
              rel="noreferrer"
              className="shine-link font-semibold"
            >
              Powered by Webdo Agency
            </a>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <a
              href="https://webdoagency.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              Need a website too? We build it for you.
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
