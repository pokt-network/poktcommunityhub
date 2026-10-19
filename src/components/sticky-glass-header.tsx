"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 12;

export function StickyGlassHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,backdrop-filter,-webkit-backdrop-filter] duration-300 ease-out ${
        scrolled
          ? "keep-glass bg-[#050508]/55 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[#050508]/40"
          : "bg-transparent"
      }`}
    >
      {children}
    </header>
  );
}
