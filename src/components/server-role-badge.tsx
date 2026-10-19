import type { ServerRoleSummary } from "@/lib/db";
import { cn } from "@/lib/utils";
import { LuX } from "react-icons/lu";

type ServerRoleBadgeProps = {
  role: Pick<ServerRoleSummary, "name" | "color"> & {
    id?: string;
    xp_required?: number;
  };
  size?: "xs" | "sm" | "md";
  showXp?: boolean;
  onRemove?: () => void;
  className?: string;
};

export function ServerRoleBadge({
  role,
  size = "sm",
  showXp = false,
  onRemove,
  className,
}: ServerRoleBadgeProps) {
  const color = role.color || "#3b82f6";

  const sizeClasses = {
    xs: "h-4.5 sm:h-5 px-1.5 sm:px-2 text-[8.5px] sm:text-[10px] gap-1 sm:gap-1.5 font-semibold sm:font-medium leading-none",
    sm: "h-5.5 sm:h-6 px-2 sm:px-2.5 text-[11px] sm:text-xs gap-1.5",
    md: "h-7 px-3 text-xs font-medium gap-2",
  };

  const dotSizes = {
    xs: "h-1 w-1 sm:h-1.5 sm:w-1.5",
    sm: "h-1.5 w-1.5 sm:h-2 sm:w-2",
    md: "h-2.5 w-2.5",
  };

  const labelMaxW = {
    xs: "max-w-[82px] sm:max-w-[140px]",
    sm: "max-w-[120px] sm:max-w-[160px]",
    md: "max-w-[160px] sm:max-w-[200px]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-all select-none backdrop-blur-md",
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}40`,
        borderWidth: "1px",
        color: "#ffffff",
      }}
      title={
        role.xp_required !== undefined
          ? `${role.name} (${role.xp_required} XP)`
          : role.name
      }
    >
      <span
        className={cn("shrink-0 rounded-full", dotSizes[size])}
        style={{
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}80`,
        }}
        aria-hidden
      />
      <span className={cn("truncate tracking-tight", labelMaxW[size])}>{role.name}</span>
      {showXp && role.xp_required !== undefined && role.xp_required > 0 ? (
        <span
          className="text-[8px] sm:text-[10px] font-semibold opacity-75 tabular-nums"
          style={{ color }}
        >
          {role.xp_required} XP
        </span>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          aria-label={`Remove role ${role.name}`}
        >
          <LuX className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </span>
  );
}
