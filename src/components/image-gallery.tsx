"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getGeneratedImages, deleteGeneratedImage } from "@/lib/supabase";
import type { GeneratedImage } from "@/lib/database.types";
import {
  Images,
  Trash2,
  ArrowRight,
  Calendar,
  Settings2,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";

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
              <div className="flex flex-col items-center gap-4">
                {/* Elegant spinner */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-lime-400/10 blur-md animate-pulse" />
                  <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-lime-400 border-r-lime-400/40 animate-spin" />
                </div>
                <p className="text-xs text-zinc-500">Loading gallery...</p>
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
                  <img
                    src={selectedImage.image_url}
                    alt={selectedImage.prompt}
                    className="w-full aspect-square object-cover rounded-xl"
                  />

                  {/* Prompt */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">
                      Prompt
                    </h4>
                    <p className="text-sm text-white bg-zinc-800/50 rounded-lg p-3">
                      {selectedImage.prompt}
                    </p>
                  </div>

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
    </div>
  );
}

