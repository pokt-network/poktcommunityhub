import Image from "next/image";
import { DM_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const xpNumeral = DM_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
});

type XpBadgeProps = {
  amount: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showAmount?: boolean;
  /** Kept for call-site compat; number always sits in the badge pill. */
  layout?: "row" | "stack";
};

const SIZES = {
  xs: {
    box: "h-11 w-11",
    img: 44,
    text: "text-[9px]",
  },
  sm: {
    box: "h-14 w-14",
    img: 56,
    text: "text-[11px]",
  },
  md: {
    box: "h-[4.5rem] w-[4.5rem]",
    img: 72,
    text: "text-xs",
  },
  lg: {
    box: "h-28 w-28 sm:h-36 sm:w-36",
    img: 144,
    text: "text-base sm:text-lg",
  },
} as const;

export function XpBadge({
  amount,
  size = "md",
  className,
  showAmount = true,
}: XpBadgeProps) {
  const s = SIZES[size];
  const label = amount.toLocaleString();

  return (
    <div
      className={cn("relative isolate shrink-0 overflow-hidden", s.box, className)}
      aria-label={`${amount} XP`}
    >
      <Image
        src="/pokt-xp-badge.png"
        alt=""
        width={s.img}
        height={s.img}
        className="pointer-events-none h-full w-full object-contain drop-shadow-[0_0_16px_rgba(124,92,255,0.45)]"
        priority={size === "lg"}
      />
      {showAmount ? (
        <span
          className={cn(
            xpNumeral.className,
            "pointer-events-none absolute z-10 whitespace-nowrap text-center",
            "font-bold leading-none tracking-wide text-white tabular-nums",
            s.text,
          )}
          style={{
            left: "50%",
            top: "78%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
