"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "dots" | "pulse" | "orbit";
  className?: string;
  label?: string;
  sublabel?: string;
  showEmoji?: boolean;
  emoji?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

const ringSize = {
  sm: "border-2",
  md: "border-2",
  lg: "border-[3px]",
  xl: "border-[3px]",
};

export function Spinner({
  size = "md",
  variant = "default",
  className,
  label,
  sublabel,
  showEmoji = false,
  emoji = "🍌",
}: SpinnerProps) {
  if (variant === "dots") {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "rounded-full bg-lime-400",
                size === "sm" && "w-1.5 h-1.5",
                size === "md" && "w-2 h-2",
                size === "lg" && "w-2.5 h-2.5",
                size === "xl" && "w-3 h-3"
              )}
              style={{
                animation: "bounce 1.4s infinite ease-in-out both",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
        {label && (
          <div className="text-center">
            <p className="text-sm font-medium text-white">{label}</p>
            {sublabel && <p className="text-xs text-zinc-500 mt-0.5">{sublabel}</p>}
          </div>
        )}
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={cn("flex flex-col items-center gap-4", className)}>
        <div className="relative">
          {/* Outer pulse rings */}
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-lime-400/20",
              sizeClasses[size]
            )}
            style={{ animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }}
          />
          <div
            className={cn(
              "absolute rounded-full bg-lime-400/10",
              size === "sm" && "inset-[-4px]",
              size === "md" && "inset-[-6px]",
              size === "lg" && "inset-[-8px]",
              size === "xl" && "inset-[-10px]"
            )}
            style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
          />
          {/* Center icon */}
          <div
            className={cn(
              "relative flex items-center justify-center rounded-2xl bg-zinc-800 border border-lime-400/20 shadow-lg shadow-lime-400/10",
              sizeClasses[size]
            )}
          >
            {showEmoji ? (
              <span
                className={cn(
                  size === "sm" && "text-sm",
                  size === "md" && "text-lg",
                  size === "lg" && "text-2xl",
                  size === "xl" && "text-3xl"
                )}
                style={{ animation: "bounce 1s infinite" }}
              >
                {emoji}
              </span>
            ) : (
              <div
                className={cn(
                  "rounded-full border-lime-400/30 border-t-lime-400",
                  ringSize[size],
                  size === "sm" && "w-2.5 h-2.5",
                  size === "md" && "w-4 h-4",
                  size === "lg" && "w-6 h-6",
                  size === "xl" && "w-8 h-8"
                )}
                style={{ animation: "spin 1s linear infinite" }}
              />
            )}
          </div>
        </div>
        {label && (
          <div className="text-center">
            <p className="text-sm font-medium text-white">{label}</p>
            {sublabel && <p className="text-xs text-zinc-500 mt-0.5">{sublabel}</p>}
          </div>
        )}
      </div>
    );
  }

  if (variant === "orbit") {
    return (
      <div className={cn("flex flex-col items-center gap-4", className)}>
        <div className="relative">
          {/* Orbiting dots */}
          <div
            className={cn("relative", sizeClasses[size])}
            style={{ animation: "spin 2s linear infinite" }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-lime-400"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: `rotate(${i * 90}deg) translateX(${
                    size === "sm" ? 8 : size === "md" ? 14 : size === "lg" ? 20 : 26
                  }px) translateY(-50%)`,
                  opacity: 1 - i * 0.2,
                }}
              />
            ))}
          </div>
          {/* Center emoji */}
          {showEmoji && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={cn(
                  size === "sm" && "text-xs",
                  size === "md" && "text-sm",
                  size === "lg" && "text-lg",
                  size === "xl" && "text-xl"
                )}
              >
                {emoji}
              </span>
            </div>
          )}
        </div>
        {label && (
          <div className="text-center">
            <p className="text-sm font-medium text-white">{label}</p>
            {sublabel && <p className="text-xs text-zinc-500 mt-0.5">{sublabel}</p>}
          </div>
        )}
      </div>
    );
  }

  // Default variant - elegant ring spinner
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        {/* Glow effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-lime-400/20 blur-md",
            sizeClasses[size]
          )}
        />
        {/* Main spinner ring */}
        <div
          className={cn(
            "relative rounded-full border-lime-400/20 border-t-lime-400 border-r-lime-400/50",
            ringSize[size],
            sizeClasses[size]
          )}
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        {/* Inner accent */}
        {(size === "lg" || size === "xl") && (
          <div
            className={cn(
              "absolute rounded-full border-lime-300/30 border-b-lime-300",
              "border-2",
              size === "lg" && "inset-1.5 w-6 h-6",
              size === "xl" && "inset-2 w-8 h-8"
            )}
            style={{ animation: "spin 1.2s linear infinite reverse" }}
          />
        )}
      </div>
      {label && (
        <div className="text-center">
          <p className="text-sm font-medium text-white">{label}</p>
          {sublabel && <p className="text-xs text-zinc-500 mt-0.5">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}

// Loading card - for larger loading states with context
interface LoadingCardProps {
  title?: string;
  subtitle?: string;
  emoji?: string;
  showProgress?: boolean;
  className?: string;
}

export function LoadingCard({
  title = "Loading",
  subtitle,
  emoji = "🍌",
  showProgress = false,
  className,
}: LoadingCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800/80 via-zinc-900 to-zinc-800/80 border border-zinc-700/50",
        className
      )}
    >
      {/* Animated shimmer background */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />

      <div className="relative flex flex-col items-center justify-center p-8 gap-5">
        {/* Animated emoji container */}
        <div className="relative">
          {/* Pulse rings */}
          <div className="absolute inset-[-12px] rounded-full bg-lime-400/5 animate-[pulse_2s_ease-in-out_infinite]" />
          <div className="absolute inset-[-6px] rounded-full bg-lime-400/10 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" />

          {/* Main icon container */}
          <div className="relative w-16 h-16 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-600/50 shadow-xl shadow-black/20">
            <span className="text-3xl animate-[bounce_1s_ease-in-out_infinite]">{emoji}</span>
          </div>
        </div>

        {/* Text content */}
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-white">{title}</p>
          {subtitle && (
            <p className="text-sm text-zinc-400">{subtitle}</p>
          )}
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div className="w-40 h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-lime-500 via-lime-400 to-lime-500 rounded-full"
              style={{
                animation: "progress 2s ease-in-out infinite",
                backgroundSize: "200% 100%",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Skeleton loader for image placeholders
interface ImageSkeletonProps {
  className?: string;
  aspectRatio?: "square" | "video" | "portrait";
}

export function ImageSkeleton({
  className,
  aspectRatio = "video",
}: ImageSkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800",
        aspectRatio === "square" && "aspect-square",
        aspectRatio === "video" && "aspect-video",
        aspectRatio === "portrait" && "aspect-[3/4]",
        className
      )}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-zinc-600 border-t-lime-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm">✨</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}
