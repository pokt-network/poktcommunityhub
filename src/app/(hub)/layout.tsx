import { Suspense, type ReactNode } from "react";
import { HubAtmosphere } from "@/components/hub-atmosphere";
import { HubShellHeader } from "@/components/hub-shell-header";

function AtmosphereFallback() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-dvh overflow-hidden"
      aria-hidden
    >
      <div className="bg-hero-glow absolute inset-0 opacity-35" />
    </div>
  );
}

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-atmosphere relative flex min-h-full flex-1 flex-col max-w-full overflow-x-clip">
      <Suspense fallback={<AtmosphereFallback />}>
        <HubAtmosphere />
      </Suspense>

      <div className="relative z-10 flex min-h-full flex-1 flex-col max-w-full">
        <HubShellHeader />
        <div className="flex min-h-0 flex-1 flex-col max-w-full">{children}</div>
      </div>
    </div>
  );
}
