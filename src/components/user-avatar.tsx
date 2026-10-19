"use client";

import { useState } from "react";
import { normalizeAvatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
};

export function UserAvatar({
  name,
  src,
  size = 40,
  className,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const imageSrc = normalizeAvatarUrl(src);
  const showImage = Boolean(imageSrc) && !failed;

  if (!showImage) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-[#8eb6ff]",
          className,
        )}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc!}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-full border border-primary/25 object-cover",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
