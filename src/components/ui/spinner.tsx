"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-lime-400 animate-spin" />
    </div>
  );
}

// Page loader with logo
interface PageLoaderProps {
  className?: string;
}

export function PageLoader({ className }: PageLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
        <span className="text-2xl">🍌</span>
      </div>
      <Spinner size="md" />
    </div>
  );
}

