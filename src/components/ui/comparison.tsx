"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ComparisonProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  firstImage?: string;
  secondImage?: string;
  before?: string;
  after?: string;
  firstImageClassName?: string;
  secondImageClassname?: string;
  initialPosition?: number;
  slideMode?: boolean; // Accept but don't pass to DOM
};

export function Comparison({
  firstImage,
  secondImage,
  before,
  after,
  firstImageClassName,
  secondImageClassname,
  initialPosition = 50,
  className,
  slideMode, // Destructure to prevent passing to DOM
  ...props
}: ComparisonProps) {
  // Support both naming conventions
  const beforeImage = before || firstImage;
  const afterImage = after || secondImage;
  const [position, setPosition] = React.useState(initialPosition);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const updatePosition = React.useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(Math.max(pct, 0), 100));
  }, []);

  const handlePointerMove = React.useCallback(
    (event: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
      if ("buttons" in event && event.buttons !== 1) return;
      updatePosition(event.clientX);
    },
    [updatePosition]
  );

  const handleTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 0) return;
      updatePosition(event.touches[0].clientX);
    },
    [updatePosition]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative isolate h-full w-full overflow-hidden rounded-lg bg-black/40 touch-none",
        className
      )}
      onPointerDown={(e) => updatePosition(e.clientX)}
      onPointerMove={handlePointerMove}
      onTouchMove={handleTouchMove}
      {...props}
    >
      {/* After image as background (visible on the right) */}
      {afterImage && (
        <img
          src={afterImage}
          alt="After"
          className={cn("absolute inset-0 h-full w-full object-cover", secondImageClassname)}
          draggable={false}
        />
      )}
      {/* Before image clipped (visible on the left) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {beforeImage && (
          <img
            src={beforeImage}
            alt="Before"
            className={cn("h-full w-full object-cover", firstImageClassName)}
            draggable={false}
          />
        )}
      </div>

      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        <div className="h-full w-px bg-white/80 shadow-[0_0_12px_rgba(0,0,0,0.45)]" />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-lg border border-white/30">
          ⇆
        </div>
      </div>
    </div>
  );
}
