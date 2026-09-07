import type { ReactNode } from "react";
import { useLenis } from "./useLenis";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";

export function MarketingLayout({ children }: { children: ReactNode }) {
  useLenis();

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
