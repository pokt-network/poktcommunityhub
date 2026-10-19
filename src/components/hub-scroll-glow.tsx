"use client";

import { useEffect, useRef } from "react";

const SECTION_SELECTOR = "[data-hub-glow]";
const LERP = 0.08;
const S_X = [50, 24, 76, 50, 28, 72];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

type Waypoint = { x: number; y: number };

/** Sample a smooth Catmull-Rom ribbon through waypoints. */
function sampleCurve(points: Waypoint[], samplesPerSeg = 18): Waypoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  const out: Waypoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function pointOnProgress(points: Waypoint[], progress: number): Waypoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const max = points.length - 1;
  const f = clamp(progress, 0, 1) * max;
  const i = Math.min(Math.floor(f), max - 1);
  const t = smoothstep(f - i);
  return {
    x: lerp(points[i].x, points[i + 1].x, t),
    y: lerp(points[i].y, points[i + 1].y, t),
  };
}

/**
 * Super-smooth glow: continuous canvas ribbon (no hard circle nodes).
 * Hero = soft radial bloom; scroll = S-curve trail with heavy blur.
 */
export function HubScrollGlow() {
  const bloomRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cur = useRef({ x: 0, y: 0, thin: 0, progress: 0 });
  const target = useRef({ x: 0, y: 0, thin: 0, progress: 0 });
  const raf = useRef(0);
  const t0 = useRef(0);

  useEffect(() => {
    const bloom = bloomRef.current;
    const canvas = canvasRef.current;
    if (!bloom || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t0.current = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const readWaypoints = (): Waypoint[] => {
      const sections = [
        ...document.querySelectorAll<HTMLElement>(SECTION_SELECTOR),
      ];
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      return sections.map((el, i) => {
        const rect = el.getBoundingClientRect();
        const customX = el.dataset.glowX
          ? Number(el.dataset.glowX)
          : S_X[i % S_X.length];
        return {
          x: (clamp(customX, 12, 88) / 100) * vw,
          y: rect.top + Math.min(rect.height * 0.32, vh * 0.28),
        };
      });
    };

    const pickTarget = (curve: Waypoint[], waypoints: Waypoint[]) => {
      const vh = window.innerHeight;
      const hero = document.querySelector<HTMLElement>('[data-hub-glow="hero"]');

      if (hero) {
        const hr = hero.getBoundingClientRect();
        target.current.thin = clamp((-hr.bottom + vh * 0.5) / (vh * 0.65), 0, 1);
      } else {
        target.current.thin = 0.9;
      }

      if (waypoints.length === 0) {
        target.current.x = window.innerWidth * 0.5;
        target.current.y = vh * 0.28;
        target.current.progress = 0;
        return;
      }

      const focusY = vh * 0.4;
      let seg = 0;
      let localT = 0;

      if (waypoints.length === 1) {
        target.current.progress = 0;
      } else {
        if (focusY <= waypoints[0].y) {
          seg = 0;
          localT = 0;
        } else if (focusY >= waypoints[waypoints.length - 1].y) {
          seg = waypoints.length - 2;
          localT = 1;
        } else {
          for (let i = 0; i < waypoints.length - 1; i++) {
            const a = waypoints[i];
            const b = waypoints[i + 1];
            if (focusY >= a.y && focusY <= b.y) {
              seg = i;
              localT = (focusY - a.y) / Math.max(1, b.y - a.y);
              break;
            }
          }
        }
        target.current.progress = (seg + localT) / (waypoints.length - 1);
      }

      const p = pointOnProgress(curve.length ? curve : waypoints, target.current.progress);
      target.current.x = p.x;
      target.current.y = clamp(p.y, vh * 0.1, vh * 0.9);
    };

    const drawRibbon = (
      curve: Waypoint[],
      head: Waypoint,
      thin: number,
      time: number,
    ) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      if (curve.length < 2) return;

      // Trail only kicks in as we leave the hero
      const trailAlpha = thin * 0.9;
      if (trailAlpha < 0.02) return;

      const baseWidth = lerp(140, 72, thin);
      const blur = lerp(48, 36, thin);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // Heavy blur = one continuous cloud, no circle nodes
      ctx.filter = `blur(${blur}px)`;

      // Soft outer wash
      ctx.beginPath();
      ctx.moveTo(curve[0].x, curve[0].y);
      for (let i = 1; i < curve.length; i++) {
        ctx.lineTo(curve[i].x, curve[i].y);
      }
      ctx.strokeStyle = `rgba(90, 110, 255, ${0.22 * trailAlpha})`;
      ctx.lineWidth = baseWidth * 2.4;
      ctx.stroke();

      // Mid ribbon
      ctx.beginPath();
      ctx.moveTo(curve[0].x, curve[0].y);
      for (let i = 1; i < curve.length; i++) {
        ctx.lineTo(curve[i].x, curve[i].y);
      }
      ctx.strokeStyle = `rgba(100, 140, 255, ${0.38 * trailAlpha})`;
      ctx.lineWidth = baseWidth * 1.35;
      ctx.stroke();

      // Core
      ctx.beginPath();
      ctx.moveTo(curve[0].x, curve[0].y);
      for (let i = 1; i < curve.length; i++) {
        ctx.lineTo(curve[i].x, curve[i].y);
      }
      ctx.strokeStyle = `rgba(140, 120, 255, ${0.45 * trailAlpha})`;
      ctx.lineWidth = baseWidth * 0.55;
      ctx.stroke();

      // Smooth highlight around the scroll head (still a soft wash, not a hard disk)
      const pulse = 0.92 + Math.sin(time * 0.8) * 0.08;
      const grad = ctx.createRadialGradient(
        head.x,
        head.y,
        0,
        head.x,
        head.y,
        baseWidth * 1.8,
      );
      grad.addColorStop(0, `rgba(160, 180, 255, ${0.55 * trailAlpha * pulse})`);
      grad.addColorStop(0.35, `rgba(110, 130, 255, ${0.28 * trailAlpha * pulse})`);
      grad.addColorStop(1, "rgba(80, 100, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(head.x, head.y, baseWidth * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const tick = (now: number) => {
      const waypoints = readWaypoints();
      const curve = sampleCurve(waypoints, 20);
      pickTarget(curve, waypoints);

      const c = cur.current;
      const t = target.current;

      if (reduced) {
        c.x = t.x;
        c.y = t.y;
        c.thin = t.thin;
        c.progress = t.progress;
      } else {
        c.x += (t.x - c.x) * LERP;
        c.y += (t.y - c.y) * LERP;
        c.thin += (t.thin - c.thin) * LERP;
        c.progress += (t.progress - c.progress) * LERP;
      }

      const time = reduced ? 0 : ((now - t0.current) / 1000);
      const thin = c.thin;
      const vh = window.innerHeight;
      const head = pointOnProgress(curve.length ? curve : waypoints, c.progress);

      // Hero bloom — large soft circle, fades as the ribbon takes over
      bloom.style.setProperty(
        "--glow-y",
        `${clamp((c.y / Math.max(vh, 1)) * 100, 18, 42).toFixed(2)}%`,
      );
      bloom.style.opacity = String(
        (1 - thin * 0.97) * (0.88 + Math.sin(time * 0.35) * 0.06),
      );

      drawRibbon(curve, { x: c.x || head.x, y: c.y || head.y }, thin, time);

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-dvh overflow-hidden"
      aria-hidden
    >
      <div ref={bloomRef} className="bg-hero-glow absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
