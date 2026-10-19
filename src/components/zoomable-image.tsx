"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { LuX, LuRotateCcw } from "react-icons/lu";

type ZoomableImageProps = {
  src: string;
  alt?: string;
  className?: string;
  wrapperClassName?: string;
};

export function ZoomableImage({
  src,
  alt = "Proof image",
  className,
  wrapperClassName,
}: ZoomableImageProps) {
  const [isMobileOrTouch, setIsMobileOrTouch] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  // Gesture tracking refs
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const initialDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);
  const lastTapRef = useRef(0);

  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => {
      setIsMobileOrTouch(
        window.matchMedia("(pointer: coarse)").matches ||
        window.innerWidth < 1024 ||
        navigator.maxTouchPoints > 0 ||
        "ontouchstart" in window,
      );
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const openModal = () => {
    resetZoom();
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    resetZoom();
  };

  // Lock background scroll and listen for Escape key when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    const origOverflow = document.body.style.overflow;
    const origTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = origOverflow;
      document.body.style.touchAction = origTouchAction;
    };
  }, [isOpen]);

  // Touch handlers inside the modal ONLY
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers: pinch
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      initialDistRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // 1 finger: double tap detector or pan start
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (scale > 1.2) {
          resetZoom();
        } else {
          setScale(2.5);
          setPosition({ x: 0, y: 0 });
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (scale > 1) {
        dragStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        posStartRef.current = { ...position };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistRef.current !== null) {
      e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = currentDist / initialDistRef.current;
      const nextScale = Math.min(Math.max(initialScaleRef.current * ratio, 1), 4);
      setScale(nextScale);
      if (nextScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPosition({
        x: posStartRef.current.x + dx,
        y: posStartRef.current.y + dy,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialDistRef.current = null;
    }
    if (e.touches.length === 0 && scale <= 1) {
      resetZoom();
    }
  };

  // On laptop/desktop: simple direct link, no pinch modal
  if (!isMobileOrTouch) {
    return (
      <div className={wrapperClassName ?? "flex justify-start"}>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          title="Open full-resolution image in new tab"
          className="group relative inline-block max-w-full overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#070b14] p-1 transition-colors hover:border-[#3d6bb0]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={
              className ??
              "max-h-[30rem] max-w-full h-auto w-auto rounded-lg object-contain transition duration-200 group-hover:scale-[1.01] sm:max-h-[36rem]"
            }
          />
        </a>
      </div>
    );
  }

  // On mobile/touch: tapping opens dedicated pinch-to-zoom modal
  return (
    <>
      <div className={wrapperClassName ?? "flex justify-start"}>
        <button
          type="button"
          onClick={openModal}
          title="Tap to view and pinch-zoom image"
          className="group relative inline-block max-w-full overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#070b14] p-1 text-left transition-colors hover:border-[#3d6bb0] focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={
              className ??
              "max-h-[30rem] max-w-full h-auto w-auto rounded-lg object-contain transition duration-200 group-hover:scale-[1.01] sm:max-h-[36rem]"
            }
          />
        </button>
      </div>

      {/* Render the modal at the root of document.body via Portal */}
      {isOpen && isMounted && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Image zoom viewer"
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl touch-none select-none"
              onClick={closeModal}
            >
              {/* Close Button TOP RIGHT */}
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close image zoom"
                className="absolute top-4 right-4 z-[10000] flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white shadow-2xl backdrop-blur-xl transition hover:bg-white/30 active:scale-95"
              >
                <LuX className="h-6 w-6" aria-hidden />
              </button>

              {/* Top info badge (scale & hint) */}
              <div
                className="absolute top-4 left-4 z-[10000] flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 backdrop-blur-md text-xs text-white pointer-events-none"
              >
                <span className="font-semibold tabular-nums text-[#8eb6ff]">
                  {Math.round(scale * 100)}%
                </span>
                <span className="text-[11px] text-muted">
                  • Pinch or double-tap to zoom
                </span>
              </div>

              {/* Zoom Reset button when zoomed */}
              {scale > 1.05 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetZoom();
                  }}
                  className="absolute bottom-6 z-[10000] inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md transition hover:bg-black/90 active:scale-95"
                >
                  <LuRotateCcw className="h-3.5 w-3.5 text-[#8eb6ff]" />
                  <span>Reset zoom</span>
                </button>
              ) : null}

              {/* Pinch & Pan Area */}
              <div
                className="relative flex h-full w-full items-center justify-center p-4 touch-none overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt}
                  draggable={false}
                  className="max-h-[85vh] max-w-[95vw] object-contain rounded-lg shadow-2xl pointer-events-none transition-transform duration-75 ease-out"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
