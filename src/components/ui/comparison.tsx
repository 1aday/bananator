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
  const [beforeLoaded, setBeforeLoaded] = React.useState(false);
  const [afterLoaded, setAfterLoaded] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const imageLoaded = beforeLoaded && afterLoaded;

  // Preload both images in parallel when they change
  React.useEffect(() => {
    let cancelled = false;

    setBeforeLoaded(false);
    setAfterLoaded(false);

    const preload = (
      url: string | undefined,
      markLoaded: React.Dispatch<React.SetStateAction<boolean>>
    ) => {
      if (!url) {
        markLoaded(true);
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (!cancelled) markLoaded(true);
      };
      img.onerror = () => {
        // Don't let the component get stuck in loading forever.
        // If an image fails to load, we still allow the comparison UI to render.
        if (!cancelled) markLoaded(true);
      };

      img.src = url;

      // Fast-path for cached images (some browsers can complete immediately)
      if (img.complete && img.naturalWidth > 0) {
        if (!cancelled) markLoaded(true);
      }
    };

    preload(beforeImage, setBeforeLoaded);
    preload(afterImage, setAfterLoaded);

    return () => {
      cancelled = true;
    };
  }, [beforeImage, afterImage]);

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
        "relative isolate overflow-hidden rounded-lg bg-zinc-800 touch-none flex items-center justify-center",
        className
      )}
      onPointerDown={(e) => updatePosition(e.clientX)}
      onPointerMove={handlePointerMove}
      onTouchMove={handleTouchMove}
      {...props}
    >
      {/* Clean skeleton loading state */}
      {!imageLoaded && (
        <div className="w-full aspect-video skeleton-loader rounded-xl flex items-center justify-center">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center animate-[breathe_2s_ease-in-out_infinite]">
            <svg className="w-5 h-5 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="18" rx="1" />
            </svg>
          </div>
        </div>
      )}

      {/* After image - determines container size */}
      {afterImage && (
        <img
          src={afterImage}
          alt="After"
          className={cn(
            "max-w-full max-h-full w-auto h-auto block object-contain transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0 absolute",
            secondImageClassname
          )}
          draggable={false}
          loading="eager"
          decoding="async"
        />
      )}
      
      {/* Before image clipped (visible on the left) - positioned absolutely */}
      {imageLoaded && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {beforeImage && (
            <img
              src={beforeImage}
              alt="Before"
              className={cn("w-full h-full object-cover", firstImageClassName)}
              draggable={false}
              loading="eager"
              decoding="async"
            />
          )}
        </div>
      )}

      {imageLoaded && (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        >
          <div className="h-full w-px bg-white/80 shadow-[0_0_12px_rgba(0,0,0,0.45)]" />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-lg border border-white/30">
            ⇆
          </div>
        </div>
      )}
    </div>
  );
}
