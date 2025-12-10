"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { getGeneratedImages, deleteGeneratedImage } from "@/lib/supabase";
import type { GeneratedImage } from "@/lib/database.types";
import {
  Images,
  Trash2,
  ArrowRight,
  Settings2,
  X,
  Loader2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Wand2,
} from "lucide-react";

// Format model name for display
function formatModelName(model: string | null): string {
  if (!model) return "Unknown";
  
  // Clean up common model name patterns
  const modelMap: Record<string, string> = {
    "nano-banana-pro/edit": "Nano Banana Pro",
    "google/nano-banana": "Google Nano Banana",
    "bytedance/seedream/v4.5/text-to-image": "Seedream 4.5",
    "bytedance/seedream/v4.5/edit": "Seedream 4.5 Edit",
  };
  
  return modelMap[model] || model.split("/").pop() || model;
}

interface ImageGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onUseAsInput: (url: string) => void;
  refreshTrigger?: number;
  projectId?: string | null;
}

export function ImageGallery({
  isOpen,
  onClose,
  onUseAsInput,
  refreshTrigger,
  projectId,
}: ImageGalleryProps) {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Full-screen zoom viewer state
  const [isZoomViewerOpen, setIsZoomViewerOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [actualSizeZoom, setActualSizeZoom] = useState<number>(1);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const loadImages = useCallback(async () => {
    // Don't load if no projectId - prevents loading all images or draw-to-edit images
    if (!projectId) {
      setImages([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await getGeneratedImages(projectId);
      setImages(data || []);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; details?: string };
      console.error("Error loading images:", err.message || err.code || JSON.stringify(error));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen, refreshTrigger, loadImages]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteGeneratedImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (selectedImage?.id === id) {
        setSelectedImage(null);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUseAsInput = (url: string) => {
    onUseAsInput(url);
    onClose();
  };

  // Calculate actual size zoom level based on image and viewport dimensions
  const calculateActualSizeZoom = useCallback(() => {
    if (!imageNaturalSize || !imageContainerRef.current) return 1;
    
    const container = imageContainerRef.current;
    const containerWidth = container.clientWidth * 0.9; // Account for 90vw/90vh constraint
    const containerHeight = container.clientHeight * 0.9;
    
    // Calculate what zoom level would show the image at 100% (1:1 pixels)
    // At zoomLevel = 1 (fit mode), the image is scaled to fit the container
    const scaleToFitWidth = containerWidth / imageNaturalSize.width;
    const scaleToFitHeight = containerHeight / imageNaturalSize.height;
    const scaleToFit = Math.min(scaleToFitWidth, scaleToFitHeight);
    
    // The actual size zoom is 1 / scaleToFit (to show at native resolution)
    const actualZoom = 1 / scaleToFit;
    return Math.max(actualZoom, 1); // At minimum, it should be 1
  }, [imageNaturalSize]);

  // Update actual size zoom when image loads or container resizes
  useEffect(() => {
    if (isZoomViewerOpen && imageNaturalSize) {
      setActualSizeZoom(calculateActualSizeZoom());
    }
  }, [isZoomViewerOpen, imageNaturalSize, calculateActualSizeZoom]);

  // Zoom viewer handlers
  const openZoomViewer = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    setHasDragged(false);
    setImageNaturalSize(null);
    setIsZoomViewerOpen(true);
  };

  const closeZoomViewer = () => {
    setIsZoomViewerOpen(false);
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    setHasDragged(false);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const newZoom = Math.max(prev / 1.5, 0.5);
      // Reset pan when zooming out to fit
      if (newZoom <= 1) {
        setPanPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleSetZoom = (level: number) => {
    if (level <= 1) {
      setPanPosition({ x: 0, y: 0 });
    }
    setZoomLevel(level);
  };

  // Zoom towards cursor position
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoomLevel * delta, 0.5), 10);
    
    if (newZoom <= 1) {
      // Reset pan when zooming out to fit
      setPanPosition({ x: 0, y: 0 });
    } else {
      // Zoom towards cursor position
      const scale = newZoom / zoomLevel;
      setPanPosition({
        x: panPosition.x * scale + mouseX * (1 - scale),
        y: panPosition.y * scale + mouseY * (1 - scale),
      });
    }
    
    setZoomLevel(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setHasDragged(false);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setHasDragged(true);
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Double-click to toggle between fit and actual size (100%)
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const isAtFit = zoomLevel === 1;
    const isAtActualSize = Math.abs(zoomLevel - actualSizeZoom) < 0.01;
    
    if (isAtFit) {
      // Zoom to actual size (100%) centered on click position
      const container = imageContainerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      
      const targetZoom = actualSizeZoom;
      setPanPosition({
        x: -mouseX * (targetZoom - 1),
        y: -mouseY * (targetZoom - 1),
      });
      setZoomLevel(targetZoom);
    } else if (isAtActualSize) {
      // Reset to fit
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    } else {
      // If at some other zoom level, go to fit
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    }
  };

  const handleSingleClick = (e: React.MouseEvent) => {
    // Only zoom if we didn't drag
    if (!hasDragged && zoomLevel === 1) {
      const container = imageContainerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      
      // Zoom to actual size (100%) or 1.5x if image is smaller than viewport
      const targetZoom = Math.max(actualSizeZoom, 1.5);
      setPanPosition({
        x: -mouseX * (targetZoom - 1),
        y: -mouseY * (targetZoom - 1),
      });
      setZoomLevel(targetZoom);
    }
    setHasDragged(false);
  };

  // Keyboard shortcuts for zoom viewer
  useEffect(() => {
    if (!isZoomViewerOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeZoomViewer();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") handleResetZoom();
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomViewerOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[85vh] bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-500/10 rounded-xl flex items-center justify-center">
              <Images className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Image History
              </h2>
              <p className="text-sm text-zinc-400">
                {images.length} images generated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center animate-[breathe_2s_ease-in-out_infinite]">
                <Images className="w-6 h-6 text-zinc-500" />
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                <Images className="w-10 h-10 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-medium">No images yet</p>
              <p className="text-sm text-zinc-600 mt-1">
                Your generated images will be saved here
              </p>
            </div>
          ) : (
            <>
              {/* Image Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      onClick={() => setSelectedImage(image)}
                      className={cn(
                        "group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all",
                        selectedImage?.id === image.id
                          ? "border-lime-500 ring-2 ring-lime-500/20"
                          : "border-transparent hover:border-zinc-700"
                      )}
                    >
                      <img
                        src={image.image_url}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                      />
                      {/* Model badge - always visible */}
                      {image.model && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                          <Wand2 className="w-2.5 h-2.5 text-lime-400" />
                          <span className="text-[10px] text-white font-medium truncate max-w-[80px]">
                            {formatModelName(image.model)}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-sm text-white line-clamp-2">
                            {image.prompt}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail Panel */}
              {selectedImage && (
                <div className="w-80 border-l border-zinc-800 overflow-y-auto p-4 space-y-4">
                  <div 
                    className="relative group cursor-zoom-in"
                    onClick={openZoomViewer}
                  >
                    <img
                      src={selectedImage.image_url}
                      alt={selectedImage.prompt}
                      className="w-full aspect-square object-cover rounded-xl transition-all group-hover:brightness-90"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/60 backdrop-blur-sm rounded-full p-3">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to zoom
                    </div>
                  </div>

                  {/* Prompt */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">
                      Prompt
                    </h4>
                    <p className="text-sm text-white bg-zinc-800/50 rounded-lg p-3">
                      {selectedImage.prompt}
                    </p>
                  </div>

                  {/* Model Badge */}
                  {selectedImage.model && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
                      <Wand2 className="w-3.5 h-3.5 text-lime-400" />
                      <span className="text-xs text-zinc-400">Generated with</span>
                      <span className="text-xs font-medium text-white">
                        {formatModelName(selectedImage.model)}
                      </span>
                    </div>
                  )}

                  {/* Settings */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                      <Settings2 className="w-4 h-4" />
                      Settings
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-zinc-800/50 rounded-lg p-2">
                        <span className="text-zinc-500 block text-xs">
                          Aspect
                        </span>
                        <span className="text-white">
                          {selectedImage.aspect_ratio}
                        </span>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-2">
                        <span className="text-zinc-500 block text-xs">
                          Resolution
                        </span>
                        <span className="text-white">
                          {selectedImage.resolution}
                        </span>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-2">
                        <span className="text-zinc-500 block text-xs">
                          Format
                        </span>
                        <span className="text-white uppercase">
                          {selectedImage.output_format}
                        </span>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-2">
                        <span className="text-zinc-500 block text-xs">
                          Created
                        </span>
                        <span className="text-white">
                          {new Date(
                            selectedImage.created_at
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Input Images */}
                  {selectedImage.input_image_urls &&
                    selectedImage.input_image_urls.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-zinc-400 mb-2">
                          Reference Images ({selectedImage.input_image_urls.length})
                        </h4>
                        <div className="flex gap-2 flex-wrap">
                          {selectedImage.input_image_urls.map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`Input ${i + 1}`}
                              className="w-12 h-12 object-cover rounded-lg border border-zinc-700"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => handleUseAsInput(selectedImage.image_url)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 rounded-xl font-medium transition-colors border border-lime-500/20"
                    >
                      Use as Input
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <a
                      href={selectedImage.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                    >
                      Open Original
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(selectedImage.id)}
                      disabled={deletingId === selectedImage.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-destructive/20 text-zinc-400 hover:text-destructive rounded-xl font-medium transition-colors"
                    >
                      {deletingId === selectedImage.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full-Screen Zoom Viewer */}
      {isZoomViewerOpen && selectedImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          {/* Image Container */}
          <div
            ref={imageContainerRef}
            className={cn(
              "absolute inset-0 flex items-center justify-center overflow-hidden",
              zoomLevel > 1 ? "cursor-grab" : "cursor-zoom-in",
              isDragging && "cursor-grabbing"
            )}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
          >
            <img
              ref={imageRef}
              src={selectedImage.image_url}
              alt={selectedImage.prompt}
              className="max-w-none select-none"
              style={{
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                maxHeight: zoomLevel <= 1 ? "90vh" : "none",
                maxWidth: zoomLevel <= 1 ? "90vw" : "none",
                transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              }}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
              }}
            />
          </div>

          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <div className="flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-3">
                {/* Zoom percentage badge */}
                <div className={cn(
                  "backdrop-blur-md rounded-xl px-4 py-2 border",
                  Math.abs(zoomLevel - actualSizeZoom) < 0.01
                    ? "bg-lime-500/20 border-lime-500/50"
                    : "bg-zinc-900/80 border-zinc-700/50"
                )}>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    Math.abs(zoomLevel - actualSizeZoom) < 0.01 ? "text-lime-400" : "text-white"
                  )}>
                    {zoomLevel === 1 ? "Fit" : Math.abs(zoomLevel - actualSizeZoom) < 0.01 ? "100%" : `${Math.round(zoomLevel * 100 / actualSizeZoom)}%`}
                  </span>
                  {zoomLevel !== 1 && actualSizeZoom > 1 && Math.abs(zoomLevel - actualSizeZoom) >= 0.01 && (
                    <span className="text-zinc-500 text-xs ml-1.5">
                      ({Math.round(zoomLevel * 100)}% of fit)
                    </span>
                  )}
                </div>
                {/* Help text */}
                <div className="hidden md:flex items-center gap-4 text-white/50 text-sm">
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-[10px] font-mono">Scroll</kbd>
                    zoom
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-[10px] font-mono">Double-click</kbd>
                    100%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-[10px] font-mono">Drag</kbd>
                    pan
                  </span>
                </div>
              </div>
              <button
                onClick={closeZoomViewer}
                className="w-10 h-10 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-md flex items-center justify-center transition-colors border border-zinc-700/50"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md rounded-2xl p-1.5 border border-zinc-700/50 shadow-2xl">
            {/* Zoom out */}
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              className="w-9 h-9 rounded-lg bg-transparent hover:bg-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4 text-white" />
            </button>
            
            {/* Zoom Slider */}
            <div className="w-28 h-9 flex items-center px-2">
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={zoomLevel}
                onChange={(e) => handleSetZoom(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-3.5
                  [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-lime-400
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:transition-all
                  [&::-webkit-slider-thumb]:hover:scale-125
                  [&::-webkit-slider-thumb]:active:scale-110
                  [&::-moz-range-thumb]:w-3.5
                  [&::-moz-range-thumb]:h-3.5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-lime-400
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
            
            {/* Zoom in */}
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 10}
              className="w-9 h-9 rounded-lg bg-transparent hover:bg-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4 text-white" />
            </button>
            
            <div className="w-px h-5 bg-zinc-700 mx-1" />
            
            {/* Zoom presets */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => handleSetZoom(1)}
                className={cn(
                  "px-2.5 h-9 rounded-lg text-xs font-medium transition-all",
                  zoomLevel === 1
                    ? "bg-lime-500/20 text-lime-400"
                    : "text-zinc-400 hover:bg-zinc-700/50 hover:text-white"
                )}
                title="Fit image to screen"
              >
                Fit
              </button>
              <button
                onClick={() => handleSetZoom(actualSizeZoom)}
                className={cn(
                  "px-2.5 h-9 rounded-lg text-xs font-medium transition-all",
                  Math.abs(zoomLevel - actualSizeZoom) < 0.01
                    ? "bg-lime-500/20 text-lime-400"
                    : "text-zinc-400 hover:bg-zinc-700/50 hover:text-white"
                )}
                title="View at actual size (1:1 pixels)"
              >
                100%
              </button>
              <button
                onClick={() => handleSetZoom(actualSizeZoom * 2)}
                className={cn(
                  "px-2.5 h-9 rounded-lg text-xs font-medium transition-all",
                  Math.abs(zoomLevel - actualSizeZoom * 2) < 0.01
                    ? "bg-lime-500/20 text-lime-400"
                    : "text-zinc-400 hover:bg-zinc-700/50 hover:text-white"
                )}
                title="View at 200% of actual size"
              >
                200%
              </button>
            </div>
            
            <div className="w-px h-5 bg-zinc-700 mx-1" />
            
            {/* Reset */}
            <button
              onClick={handleResetZoom}
              className="w-9 h-9 rounded-lg bg-transparent hover:bg-zinc-700/50 flex items-center justify-center transition-colors"
              title="Reset view (0)"
            >
              <RotateCcw className="w-4 h-4 text-zinc-400 hover:text-white transition-colors" />
            </button>
            
            {/* Open original */}
            <a
              href={selectedImage.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg bg-transparent hover:bg-zinc-700/50 flex items-center justify-center transition-colors"
              title="Open original in new tab"
            >
              <ExternalLink className="w-4 h-4 text-zinc-400 hover:text-white transition-colors" />
            </a>
          </div>

          {/* Image Info - bottom left */}
          <div className="absolute bottom-6 left-6 flex items-center gap-2">
            {selectedImage.model && (
              <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-md rounded-xl px-3 py-2 border border-zinc-700/50">
                <Wand2 className="w-3 h-3 text-lime-400" />
                <span className="text-white text-xs font-medium">{formatModelName(selectedImage.model)}</span>
              </div>
            )}
            {imageNaturalSize && (
              <div className="bg-zinc-900/80 backdrop-blur-md rounded-xl px-3 py-2 border border-zinc-700/50">
                <span className="text-zinc-500 text-xs">Native </span>
                <span className="text-white text-xs font-medium">{imageNaturalSize.width} × {imageNaturalSize.height}</span>
              </div>
            )}
            {actualSizeZoom > 1 && Math.abs(zoomLevel - actualSizeZoom) >= 0.01 && zoomLevel < actualSizeZoom && (
              <div className="bg-lime-500/10 backdrop-blur-md rounded-xl px-3 py-2 border border-lime-500/30">
                <span className="text-lime-400 text-xs font-medium">
                  Click 100% for full resolution
                </span>
              </div>
            )}
            {Math.abs(zoomLevel - actualSizeZoom) < 0.01 && (
              <div className="bg-lime-500/20 backdrop-blur-md rounded-xl px-3 py-2 border border-lime-500/50">
                <span className="text-lime-400 text-xs font-medium">
                  ✓ Viewing at full resolution
                </span>
              </div>
            )}
          </div>
          
          {/* Keyboard shortcuts hint - bottom right */}
          <div className="absolute bottom-6 right-6 hidden lg:flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md rounded-xl px-3 py-2 border border-zinc-700/50">
            <span className="text-zinc-500 text-xs flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">Esc</kbd>
              close
            </span>
            <span className="text-zinc-500 text-xs flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">0</kbd>
              reset
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

