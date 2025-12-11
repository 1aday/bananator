"use client";

import { useState, useCallback, useRef, useEffect, ChangeEvent, DragEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { saveGeneratedImage, getProject, getGeneratedImages, deleteGeneratedImage, type Project } from "@/lib/supabase";
import { PromptLibrary } from "@/components/prompt-library";
import { Comparison } from "@/components/ui/comparison";
import { Spinner } from "@/components/ui/spinner";
import { AnnotateButton } from "@/components/image-annotator";
import {
  Upload,
  Sparkles,
  X,
  Loader2,
  Download,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  Settings2,
  BookOpen,
  ChevronDown,
  RotateCcw,
  ArrowRight,
  ImageIcon,
  Wand2,
  Trash2,
  Copy,
  Check,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  ChevronUp,
  Image as ImageLucide,
  Home,
  Columns,
  Pencil,
  Plus,
} from "lucide-react";

type AspectRatio = "auto" | "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "match_input_image";
type Resolution = "1K" | "2K" | "4K";
type OutputFormat = "jpg" | "png" | "webp";
type ImageSize = "auto_2K" | "auto_4K" | "1K" | "2K" | "4K" | "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9";
type ModelType = "nano-banana-pro" | "seedream" | "seedream-edit" | "google-nano-banana";

interface ModelOption {
  value: ModelType;
  label: string;
  description: string;
  supportsImageInput: boolean;
  requiresImageInput?: boolean;
  maxImages?: number;
  sizeType: "aspectRatio" | "imageSize" | "seedreamSize";
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: "nano-banana-pro", label: "Nano Banana Pro", description: "FAL • Image editing", supportsImageInput: true, requiresImageInput: true, maxImages: 10, sizeType: "aspectRatio" },
  { value: "google-nano-banana", label: "Google Nano Banana", description: "Replicate • Fast & versatile", supportsImageInput: true, maxImages: 10, sizeType: "aspectRatio" },
  { value: "seedream-edit", label: "Seedream 4.5 Edit", description: "FAL • Multi-image editing", supportsImageInput: true, requiresImageInput: true, maxImages: 10, sizeType: "seedreamSize" },
  { value: "seedream", label: "Seedream 4.5", description: "FAL • Text to image only", supportsImageInput: false, sizeType: "imageSize" },
];

// Aspect ratios per model
const NANO_BANANA_PRO_RATIOS = ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const GOOGLE_NANO_RATIOS = ["match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
// Seedream text-to-image valid sizes (must match API exactly)
const SEEDREAM_SIZES = ["auto_2K", "auto_4K", "square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"];
// Seedream Edit uses the same size presets
const SEEDREAM_EDIT_SIZES = ["auto_4K", "auto_2K", "square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"];

// Format size labels for display
const formatSizeLabel = (size: string): string => {
  const labels: Record<string, string> = {
    "auto_2K": "Auto 2K",
    "auto_4K": "Auto 4K",
    "square_hd": "Square HD",
    "square": "Square",
    "portrait_4_3": "Portrait 4:3",
    "portrait_16_9": "Portrait 16:9",
    "landscape_4_3": "Landscape 4:3",
    "landscape_16_9": "Landscape 16:9",
  };
  return labels[size] || size;
};

type GenerationItem = {
  id: string;
  type: "generation" | "upload" | "annotated";
  inputImage?: string;
  outputImage?: string;
  prompt: string;
  timestamp: Date;
  loading?: boolean;
  error?: string;
  aspectRatio?: string;
  settings?: {
    resolution: Resolution;
    outputFormat: OutputFormat;
  };
};

export default function ProjectWorkspace() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  // Generation history (chat-like)
  const [generations, setGenerations] = useState<GenerationItem[]>([]);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Input state - supports multiple images
  const [inputImages, setInputImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [originalUploads, setOriginalUploads] = useState<string[]>([]); // Track original uploads separately
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Track active generations count for UI feedback
  const activeGenerations = generations.filter(g => g.loading).length;

  // Settings
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("auto");
  const [resolution, setResolution] = useState<Resolution>("2K");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [imageSize, setImageSize] = useState<ImageSize>("auto_2K");
  const [selectedModel, setSelectedModel] = useState<ModelType>("nano-banana-pro");
  const [showSettings, setShowSettings] = useState(false);

  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fullView, setFullView] = useState<GenerationItem | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(true); // Toggle for before/after comparison in feed
  // Mobile: bottom sheet expanded state
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [mobileShowModel, setMobileShowModel] = useState(false);
  const [mobileShowSettings, setMobileShowSettings] = useState(false);
  const [sheetDragStart, setSheetDragStart] = useState<number | null>(null);
  // Track which images have loaded in the browser
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  
  // Mark image as loaded when browser finishes loading it
  const handleImageLoaded = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id));
  }, []);
  
  // Check if cached images are already loaded on mount
  useEffect(() => {
    generations.forEach(gen => {
      if (gen.outputImage && !loadedImages.has(gen.id)) {
        const img = new Image();
        img.src = gen.outputImage;
        // If image is already cached/complete, mark it as loaded
        if (img.complete) {
          handleImageLoaded(gen.id);
        }
      }
    });
  }, [generations, loadedImages, handleImageLoaded]);

  // Handle sheet drag gestures
  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    setSheetDragStart(e.touches[0].clientY);
  }, []);

  const handleSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (sheetDragStart === null) return;
    const deltaY = sheetDragStart - e.touches[0].clientY;
    // If dragged up more than 30px, expand
    if (deltaY > 30) {
      setMobileSheetExpanded(true);
      setSheetDragStart(null);
    }
  }, [sheetDragStart]);

  const handleSheetTouchEnd = useCallback(() => {
    setSheetDragStart(null);
  }, []);

  // Load project and images
  useEffect(() => {
    const loadProject = async () => {
      try {
        const project = await getProject(projectId);
        if (project) {
          setCurrentProject(project);
          localStorage.setItem("banana_current_project_id", project.id);

          // Load existing generations
          const dbImages = await getGeneratedImages(project.id);
          if (dbImages && dbImages.length > 0) {
            const existingGenerations: GenerationItem[] = dbImages.map((img) => ({
              id: img.id,
              type: "generation",
              inputImage: img.input_image_urls?.[0] || undefined,
              outputImage: img.image_url,
              prompt: img.prompt,
              timestamp: new Date(img.created_at),
              aspectRatio: img.aspect_ratio,
              settings: {
                resolution: img.resolution as Resolution,
                outputFormat: img.output_format as OutputFormat,
              },
            }));
            // Sort by timestamp ascending (oldest first, newest at bottom)
            existingGenerations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            setGenerations(existingGenerations);
            
            // Preload all images in parallel for faster loading
            // This starts fetching before React even renders the img elements
            existingGenerations.forEach((gen) => {
              if (gen.outputImage) {
                const img = new Image();
                img.onload = () => {
                  setLoadedImages(prev => new Set(prev).add(gen.id));
                };
                img.src = gen.outputImage;
              }
            });
          }
        } else {
          router.push("/");
        }
      } catch (err) {
        console.error("Failed to load project:", err);
        router.push("/");
      } finally {
        setProjectLoading(false);
      }
    };
    loadProject();
  }, [projectId, router]);

  // Auto-scroll to bottom when new generations are added
  useEffect(() => {
    if (!projectLoading) {
      historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [generations, projectLoading]);

  // File handling - supports multiple images
  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      const newImages: string[] = [];
      
      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) continue;
        
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          newImages.push(dataUrl);
        } catch (err) {
          console.error("Error reading file:", err);
        }
      }
      
      if (newImages.length > 0) {
        setInputImages(prev => [...prev, ...newImages]);
        setOriginalUploads(prev => [...prev, ...newImages]); // Track original uploads
        setError(null);
        
        // Add uploads to the feed
        const uploadItems: GenerationItem[] = newImages.map((img, i) => ({
          id: `upload-${Date.now()}-${i}`,
          type: "upload" as const,
          outputImage: img,
          prompt: "Uploaded image",
          timestamp: new Date(),
        }));
        setGenerations(prev => [...prev, ...uploadItems]);
      }
    }
    e.target.value = "";
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files) {
      const fileArray = Array.from(files);
      const newImages: string[] = [];
      
      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) continue;
        
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          newImages.push(dataUrl);
        } catch (err) {
          console.error("Error reading file:", err);
        }
      }
      
      if (newImages.length > 0) {
        setInputImages(prev => [...prev, ...newImages]);
        setOriginalUploads(prev => [...prev, ...newImages]); // Track original uploads
        setError(null);
        
        // Add uploads to the feed
        const uploadItems: GenerationItem[] = newImages.map((img, i) => ({
          id: `upload-${Date.now()}-${i}`,
          type: "upload" as const,
          outputImage: img,
          prompt: "Uploaded image",
          timestamp: new Date(),
        }));
        setGenerations(prev => [...prev, ...uploadItems]);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Use generated image as input - auto-switch to compatible model if needed
  const useAsInput = useCallback((imageUrl: string) => {
    setInputImages(prev => [...prev, imageUrl]);
    
    // If current model doesn't support image input, switch to one that does
    const currentModelInfo = MODEL_OPTIONS.find(m => m.value === selectedModel);
    if (!currentModelInfo?.supportsImageInput) {
      // Switch to nano-banana-pro as the default image editing model
      setSelectedModel("nano-banana-pro");
      setAspectRatio("auto");
    }
  }, [selectedModel]);

  // Handle annotated image - add to feed and set as input
  const handleAnnotatedImage = useCallback((annotatedUrl: string) => {
    // Add to feed as annotated type
    const annotatedItem: GenerationItem = {
      id: `annotated-${Date.now()}`,
      type: "annotated",
      outputImage: annotatedUrl,
      prompt: "Annotated image",
      timestamp: new Date(),
    };
    setGenerations(prev => [...prev, annotatedItem]);
    
    // Set as the only input image (replace existing)
    setInputImages([annotatedUrl]);
    setSelectedImageIndex(0);
    
    // If current model doesn't support image input, switch to one that does
    const currentModelInfo = MODEL_OPTIONS.find(m => m.value === selectedModel);
    if (!currentModelInfo?.supportsImageInput) {
      setSelectedModel("nano-banana-pro");
      setAspectRatio("auto");
    }
    
    // Open mobile sheet
    setMobileSheetExpanded(true);
  }, [selectedModel]);

  // Copy prompt
  const copyPrompt = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Select prompt from library
  const handleSelectPrompt = useCallback((selectedPrompt: string) => {
    setPrompt(prev => prev.trim() ? `${prev}, ${selectedPrompt}` : selectedPrompt);
  }, []);

  // Generate image - runs independently, allows multiple simultaneous generations
  const generate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    // Check if model requires image input
    const currentModelInfo = MODEL_OPTIONS.find(m => m.value === selectedModel);
    if (currentModelInfo?.requiresImageInput && inputImages.length === 0) {
      setError(`${currentModelInfo.label} requires an input image. Please add an image or switch to a different model.`);
      return;
    }

    setError(null);

    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Capture current values for this generation
    const currentPrompt = prompt;
    const currentInputImages = [...inputImages];
    const currentAspectRatio = aspectRatio;
    const currentResolution = resolution;
    const currentOutputFormat = outputFormat;
    const currentImageSize = imageSize;
    const currentModel = selectedModel;

    // Add placeholder immediately
    const newGeneration: GenerationItem = {
      id,
      type: "generation",
      inputImage: currentInputImages[0] || undefined,
      prompt: currentPrompt,
      timestamp: new Date(),
      loading: true,
      aspectRatio: currentModel === "seedream" ? currentImageSize : currentAspectRatio,
      settings: { resolution: currentResolution, outputFormat: currentOutputFormat },
    };

    setGenerations(prev => [...prev, newGeneration]);
    
    // Clear prompt after starting generation (optional - allows quick iteration)
    // setPrompt("");

    // Run generation in background - don't await at top level
    (async () => {
      try {
        // Build request body based on model
        const requestBody: Record<string, unknown> = {
          prompt: currentPrompt,
          model: currentModel,
          outputFormat: currentOutputFormat,
          compressImages: true,
        };

        if (currentModel === "nano-banana-pro") {
          requestBody.imageInputs = currentInputImages;
          requestBody.aspectRatio = currentAspectRatio;
          requestBody.resolution = currentResolution;
        } else if (currentModel === "google-nano-banana") {
          requestBody.imageInputs = currentInputImages;
          requestBody.aspectRatio = currentAspectRatio;
        } else if (currentModel === "seedream-edit") {
          // Seedream Edit uses imageSize presets and requires image inputs
          requestBody.imageInputs = currentInputImages;
          requestBody.imageSize = currentImageSize;
        } else if (currentModel === "seedream") {
          // Seedream text-to-image uses imageSize, no image inputs
          requestBody.imageSize = currentImageSize;
        }

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to generate image");
        }

        // Save to database
        let savedId = id;
        try {
          if (currentProject) {
            const saved = await saveGeneratedImage({
              projectId: currentProject.id,
              imageUrl: data.imageUrl,
              prompt: currentPrompt,
              settings: { 
                aspectRatio: currentAspectRatio, 
                resolution: currentResolution, 
                outputFormat: currentOutputFormat, 
                safetyFilter: "block_only_high" 
              },
              inputImageUrls: data.inputImageUrls || [],
              model: data.model || currentModel,
            });
            if (saved) savedId = saved.id;
          }
        } catch (saveErr) {
          console.warn("Failed to save to database:", saveErr);
        }

        // Update generation with result
        setGenerations(prev =>
          prev.map(g =>
            g.id === id
              ? { ...g, id: savedId, outputImage: data.imageUrl, loading: false }
              : g
          )
        );
        
        // Mark as loaded immediately so we don't show spinner for fresh generations
        setLoadedImages(prev => new Set(prev).add(savedId));
        
        // Auto-set generated image as input for next iteration
        setInputImages([data.imageUrl]);
        setSelectedImageIndex(0);
      } catch (err) {
        setGenerations(prev =>
          prev.map(g =>
            g.id === id
              ? { ...g, loading: false, error: err instanceof Error ? err.message : "Generation failed" }
              : g
          )
        );
      }
    })();
  }, [prompt, inputImages, aspectRatio, resolution, outputFormat, imageSize, selectedModel, currentProject]);

  // Delete generation
  const handleDeleteGeneration = useCallback(async (id: string) => {
    setGenerations(prev => prev.filter(g => g.id !== id));
    try {
      await deleteGeneratedImage(id);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }, []);

  // Retry generation - removes failed item and starts new generation
  const retry = useCallback((gen: GenerationItem) => {
    // Remove the failed generation
    setGenerations(prev => prev.filter(g => g.id !== gen.id));
    
    // Set up the form with the same settings
    setInputImages(gen.inputImage ? [gen.inputImage] : []);
    setSelectedImageIndex(0);
    setPrompt(gen.prompt);
    if (gen.aspectRatio) setAspectRatio(gen.aspectRatio as AspectRatio);
    if (gen.settings) {
      setResolution(gen.settings.resolution);
      setOutputFormat(gen.settings.outputFormat);
    }
    
    // Trigger generation after state updates
    setTimeout(() => {
      generate();
    }, 100);
  }, [generate]);

  // Dynamic aspect ratio options based on model
  const getAspectRatioOptions = () => {
    if (selectedModel === "google-nano-banana") {
      return GOOGLE_NANO_RATIOS.map(r => ({
        value: r,
        label: r === "match_input_image" ? "Match" : r,
      }));
    }
    return NANO_BANANA_PRO_RATIOS.map(r => ({
      value: r,
      label: r === "auto" ? "Auto" : r,
    }));
  };

  const aspectRatioOptions = getAspectRatioOptions();

  // Loading state - Clean & minimal
  if (projectLoading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 animate-[breathe_2s_ease-in-out_infinite]">
          <span className="text-2xl">🍌</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col lg:flex-row overflow-hidden">
      {/* ============================================ */}
      {/* DESKTOP: Left Sidebar - Controls */}
      {/* ============================================ */}
      <div
        className={cn(
          "hidden lg:flex flex-shrink-0 bg-black/40 border-r border-white/5 flex-col transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-20" : "w-80"
        )}
      >
        {/* Header */}
        <div className={cn("p-4 border-b border-white/5", sidebarCollapsed && "px-3")}>
          <div className="flex items-center justify-between">
            <Link href="/" className={cn("flex items-center gap-2 hover:opacity-80 transition-opacity", sidebarCollapsed && "justify-center")}>
              <span className="text-2xl">🍌</span>
              <span className={cn("font-bold text-xl text-lime-400 transition-opacity", sidebarCollapsed && "hidden")}>Banana</span>
            </Link>
            
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
          </div>
          
          {currentProject && (
            <Link
              href="/"
              className={cn(
                "mt-3 flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={currentProject.name}
            >
              <FolderOpen className="w-4 h-4 text-lime-400 flex-shrink-0" />
              <span className={cn("text-sm font-medium text-white truncate flex-1", sidebarCollapsed && "hidden")}>
                {currentProject.name}
              </span>
              <ChevronDown className={cn("w-3 h-3 text-zinc-500 flex-shrink-0", sidebarCollapsed && "hidden")} />
            </Link>
          )}
        </div>

        {/* Collapsed view - icons only */}
        {sidebarCollapsed && (
          <div className="flex flex-col items-center gap-2 p-3 flex-1">
            <label
              className={cn(
                "p-3 rounded-xl cursor-pointer transition-all border-2 border-dashed",
                inputImages.length > 0 ? "bg-lime-400/10 border-lime-400/30" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
              )}
              title="Upload image"
            >
              <Upload className={cn("w-5 h-5", inputImages.length > 0 ? "text-lime-400" : "text-zinc-500")} />
              <input type="file" accept="image/*" multiple={true} onChange={handleFileSelect} className="hidden" />
            </label>
            
            <button
              onClick={() => { setSidebarCollapsed(false); setShowSettings(true); }}
              className="p-3 text-zinc-500 hover:text-white hover:bg-zinc-900/50 rounded-xl transition-colors"
              title="Settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setShowPromptLibrary(true)}
              className="p-3 text-zinc-500 hover:text-white hover:bg-zinc-900/50 rounded-xl transition-colors"
              title="Prompt Library"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            
            <div className="p-3 bg-lime-400/10 rounded-xl" title={MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}>
              <Wand2 className="w-5 h-5 text-lime-400" />
            </div>
          </div>
        )}

        {/* Expanded view */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", sidebarCollapsed && "hidden")}>
          {/* Input Images - Multi-image support */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-300">
                Input Images {inputImages.length > 0 && <span className="text-zinc-500">({inputImages.length})</span>}
              </span>
              {MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput ? (
                <span className="text-xs text-amber-400 font-medium">required</span>
              ) : MODEL_OPTIONS.find(m => m.value === selectedModel)?.supportsImageInput ? (
                <span className="text-xs text-zinc-500">(optional)</span>
              ) : (
                <span className="text-xs text-zinc-600">not used</span>
              )}
            </div>
            {inputImages.length > 0 ? (
              <div className="space-y-3">
                {/* Main selected image */}
                <div className="relative group">
                  <img src={inputImages[selectedImageIndex] || inputImages[0]} alt="Input" className="w-full aspect-video object-cover rounded-xl border border-zinc-800" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                    <label className="p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer transition-colors" title="Add more images">
                      <Plus className="w-4 h-4" />
                      <input type="file" accept="image/*" multiple={true} onChange={handleFileSelect} className="hidden" />
                    </label>
                    <button 
                      onClick={() => {
                        setInputImages(prev => prev.filter((_, i) => i !== selectedImageIndex));
                        setSelectedImageIndex(Math.max(0, selectedImageIndex - 1));
                      }} 
                      className="p-2 bg-white/10 hover:bg-red-500/50 rounded-lg transition-colors"
                      title="Remove this image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => { setInputImages([]); setSelectedImageIndex(0); }} 
                      className="p-2 bg-white/10 hover:bg-red-500/50 rounded-lg transition-colors"
                      title="Clear all images"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Thumbnails for current input images */}
                {inputImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {inputImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIndex(i)}
                        className={cn(
                          "relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all",
                          i === selectedImageIndex 
                            ? "border-lime-500 ring-2 ring-lime-500/30" 
                            : "border-zinc-700 opacity-70 hover:opacity-100 hover:border-zinc-500"
                        )}
                      >
                        <img src={img} alt={`Input ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {/* Add more button in thumbnails */}
                    <label className="flex-shrink-0 w-12 h-12 border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg flex items-center justify-center cursor-pointer transition-colors">
                      <Plus className="w-4 h-4 text-zinc-500" />
                      <input type="file" accept="image/*" multiple={true} onChange={handleFileSelect} className="hidden" />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <label
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                  isDragging ? "border-lime-500 bg-lime-500/10" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                )}
              >
                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-400">Drop images or click • Multiple supported</p>
                <input type="file" accept="image/*" multiple={true} onChange={handleFileSelect} className="hidden" />
              </label>
            )}
            
            {/* Available Images - Original uploads + Generated outputs */}
            {(originalUploads.length > 0 || generations.filter(g => g.outputImage).length > 0) && (
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-400">Select from history</span>
                  <span className="text-[10px] text-zinc-600">click to add</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* Original uploads */}
                  {originalUploads.map((img, i) => (
                    <button
                      key={`upload-${i}`}
                      onClick={() => {
                        if (!inputImages.includes(img)) {
                          setInputImages(prev => [...prev, img]);
                        }
                      }}
                      className={cn(
                        "relative w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                        inputImages.includes(img)
                          ? "border-lime-500/50 opacity-50 cursor-default"
                          : "border-zinc-700 hover:border-violet-500 hover:scale-105"
                      )}
                      title={inputImages.includes(img) ? "Already selected" : "Add to input"}
                      disabled={inputImages.includes(img)}
                    >
                      <img src={img} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Upload className="w-3 h-3 text-violet-300" />
                      </div>
                    </button>
                  ))}
                  {/* Generated outputs */}
                  {generations.filter(g => g.outputImage).map((gen) => (
                    <button
                      key={`gen-${gen.id}`}
                      onClick={() => {
                        if (gen.outputImage && !inputImages.includes(gen.outputImage)) {
                          setInputImages(prev => [...prev, gen.outputImage!]);
                        }
                      }}
                      className={cn(
                        "relative w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                        inputImages.includes(gen.outputImage!)
                          ? "border-lime-500/50 opacity-50 cursor-default"
                          : "border-zinc-700 hover:border-lime-500 hover:scale-105"
                      )}
                      title={inputImages.includes(gen.outputImage!) ? "Already selected" : "Add generated image to input"}
                      disabled={inputImages.includes(gen.outputImage!)}
                    >
                      <img src={gen.outputImage} alt="Generated" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-lime-500/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Sparkles className="w-3 h-3 text-lime-300" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-300">Prompt</span>
                <button onClick={() => setShowPromptLibrary(true)} className="text-xs text-lime-400 hover:text-lime-300 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Library
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && prompt.trim()) { e.preventDefault(); generate(); } }}
                placeholder={inputImages.length > 0 ? "Describe how to edit this image..." : "Describe the image you want to create..."}
                className="w-full h-28 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-500/50 resize-none"
              />
            </div>

            {/* Settings */}
            <div>
              <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                <Settings2 className="w-4 h-4" />
                Settings
                <ChevronDown className={cn("w-3 h-3 transition-transform", showSettings && "rotate-180")} />
              </button>
                {showSettings && (
                <div className="mt-3 space-y-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  {/* Model Selector */}
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wide">Model</span>
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      {MODEL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSelectedModel(opt.value);
                            // Reset settings when changing models
                            if (opt.value === "google-nano-banana") {
                              setAspectRatio("match_input_image");
                            } else if (opt.value === "nano-banana-pro") {
                              setAspectRatio("auto");
                            } else if (opt.value === "seedream-edit") {
                              setImageSize("auto_4K");
                            } else if (opt.value === "seedream") {
                              setImageSize("auto_2K");
                            }
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left rounded-lg transition-colors",
                            selectedModel === opt.value
                              ? "bg-lime-400/20 border border-lime-400/30"
                              : "bg-zinc-800 hover:bg-zinc-700 border border-transparent"
                          )}
                        >
                          <p className={cn("text-sm font-medium", selectedModel === opt.value ? "text-lime-400" : "text-white")}>{opt.label}</p>
                          <p className="text-xs text-zinc-500">{opt.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seedream Text-to-Image: Image Size */}
                  {selectedModel === "seedream" && (
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wide">Image Size</span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {SEEDREAM_SIZES.map((size) => (
                          <button key={size} onClick={() => setImageSize(size as ImageSize)}
                            className={cn("px-2 py-1 text-xs rounded-md transition-colors", imageSize === size ? "bg-lime-400 text-black font-medium" : "bg-zinc-800 text-zinc-400 hover:text-white")}
                          >{formatSizeLabel(size)}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Seedream Edit: Size Presets */}
                  {selectedModel === "seedream-edit" && (
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wide">Output Size</span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {SEEDREAM_EDIT_SIZES.map((size) => (
                          <button key={size} onClick={() => setImageSize(size as ImageSize)}
                            className={cn("px-2 py-1 text-xs rounded-md transition-colors", imageSize === size ? "bg-lime-400 text-black font-medium" : "bg-zinc-800 text-zinc-400 hover:text-white")}
                          >{formatSizeLabel(size)}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nano Banana Pro / Google: Aspect Ratio */}
                  {(selectedModel === "nano-banana-pro" || selectedModel === "google-nano-banana") && (
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wide">Aspect Ratio</span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {aspectRatioOptions.map((opt) => (
                          <button key={opt.value} onClick={() => setAspectRatio(opt.value as AspectRatio)}
                            className={cn("px-2 py-1 text-xs rounded-md transition-colors", aspectRatio === opt.value ? "bg-lime-400 text-black font-medium" : "bg-zinc-800 text-zinc-400 hover:text-white")}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution - only for Nano Banana Pro */}
                  {selectedModel === "nano-banana-pro" && (
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wide">Resolution</span>
                      <div className="flex gap-1 mt-1.5">
                        {["1K", "2K", "4K"].map((res) => (
                          <button key={res} onClick={() => setResolution(res as Resolution)}
                            className={cn("px-3 py-1 text-xs rounded-md transition-colors", resolution === res ? "bg-lime-400 text-black font-medium" : "bg-zinc-800 text-zinc-400 hover:text-white")}
                          >{res}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Format */}
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wide">Format</span>
                    <div className="flex gap-1 mt-1.5">
                      {(selectedModel === "google-nano-banana" ? ["png", "jpg", "webp"] : ["png", "jpg"]).map((fmt) => (
                        <button key={fmt} onClick={() => setOutputFormat(fmt as OutputFormat)}
                          className={cn("px-3 py-1 text-xs rounded-md transition-colors uppercase", outputFormat === fmt ? "bg-lime-400 text-black font-medium" : "bg-zinc-800 text-zinc-400 hover:text-white")}
                        >{fmt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="w-full p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:bg-zinc-800/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-lime-400/20 rounded-lg flex items-center justify-center"><Wand2 className="w-4 h-4 text-lime-400" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {MODEL_OPTIONS.find(m => m.value === selectedModel)?.description}
                  </p>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", showSettings && "rotate-180")} />
              </div>
            </button>
          </div>

          {/* Generate Button */}
          <div className="p-4 border-t border-white/5">
            {error && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg"><p className="text-xs text-red-400">{error}</p></div>}
            {activeGenerations > 0 && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-lime-400/10 border border-lime-400/20 rounded-lg">
                <Loader2 className="w-4 h-4 text-lime-400 animate-spin" />
                <span className="text-xs text-lime-400">{activeGenerations} generation{activeGenerations > 1 ? 's' : ''} in progress</span>
              </div>
            )}
            {/* Warning if model requires image but none provided */}
            {MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0 && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Upload className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400">Add an image to use {MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}</span>
              </div>
            )}
            <button
              onClick={generate}
              disabled={!prompt.trim() || (MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0)}
              className={cn(
                "w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all", 
                !prompt.trim() || (MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0)
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                  : "bg-lime-400 text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20"
              )}
            >
              <Sparkles className="w-5 h-5" />
              Generate
            </button>
          </div>
        </div>

        {sidebarCollapsed && (
          <div className="p-3 border-t border-white/5">
            <button 
              onClick={generate} 
              disabled={!prompt.trim() || (MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0)}
              className={cn(
                "w-full p-3 rounded-xl transition-all flex items-center justify-center", 
                !prompt.trim() || (MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0)
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                  : "bg-lime-400 text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20"
              )}
              title={MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0 ? "Add an image first" : "Generate"}
            ><Sparkles className="w-5 h-5" /></button>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* MAIN CONTENT AREA */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col overflow-hidden pb-[140px] lg:pb-0">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <Link href="/" className="lg:hidden flex items-center gap-2">
              <span className="text-xl">🍌</span>
            </Link>
            <div className="hidden lg:flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Generations</h2>
              {generations.length > 0 && (
                <span className="px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400">{generations.length}</span>
              )}
            </div>
            {currentProject && (
              <span className="lg:hidden text-sm font-medium text-white truncate max-w-[150px]">{currentProject.name}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setShowBeforeAfter(!showBeforeAfter)} 
              className={cn(
                "p-2 rounded-lg transition-colors",
                showBeforeAfter ? "text-lime-400 bg-lime-400/10" : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
              title={showBeforeAfter ? "Hide before/after comparison" : "Show before/after comparison"}
            >
              <Columns className="w-5 h-5" />
            </button>
            <button onClick={() => setShowPromptLibrary(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Prompt Library">
              <BookOpen className="w-5 h-5" />
            </button>
            <Link href="/" className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors lg:hidden" title="Home">
              <Home className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* History Feed */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {generations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-zinc-700" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Start Creating</h3>
              <p className="text-zinc-500 max-w-xs text-sm">
                Enter a prompt below and tap Generate to create your first image
              </p>
            </div>
          ) : (
            <div className="space-y-6 mx-auto w-full">
              {generations.map((gen) => (
                <div key={gen.id} className="group bg-zinc-900/30 border border-zinc-800/50 rounded-2xl overflow-hidden">
                  {/* Header bar */}
                  <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-zinc-800/30">
                    {gen.type === "upload" ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs font-medium rounded-md flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          Upload
                        </span>
                        <span className="text-sm text-zinc-400">Reference image</span>
                      </div>
                    ) : gen.type === "annotated" ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-md flex items-center gap-1">
                          <Pencil className="w-3 h-3" />
                          Annotated
                        </span>
                        <span className="text-sm text-zinc-400">Marked up for generation</span>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-300 flex-1 line-clamp-1">{gen.prompt}</p>
                    )}
                    <div className="flex items-center gap-1">
                      {gen.type === "generation" && (
                        <>
                          <span className="text-xs text-zinc-600">{gen.aspectRatio || "auto"}</span>
                          <button onClick={() => copyPrompt(gen.prompt, gen.id)} className="p-1.5 text-zinc-600 hover:text-white transition-colors flex-shrink-0">
                            {copiedId === gen.id ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Image - maximized to fit viewport */}
                  <div className="relative flex items-center justify-center bg-zinc-950/50">
                    {gen.loading ? (
                      <div className="w-full aspect-[4/3] max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-200px)] skeleton-generating flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-lime-400/10 flex items-center justify-center border border-lime-400/20 animate-[breathe_2s_ease-in-out_infinite]">
                            <Sparkles className="w-5 h-5 text-lime-400" />
                          </div>
                          <span className="text-sm text-zinc-400">Generating...</span>
                        </div>
                      </div>
                    ) : gen.error ? (
                      <div className="w-full min-h-[200px] bg-zinc-800 flex items-center justify-center">
                        <div className="text-center p-4">
                          <p className="text-red-400 mb-3 text-sm">{gen.error}</p>
                          <button onClick={() => retry(gen)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm flex items-center gap-2 mx-auto">
                            <RotateCcw className="w-4 h-4" />Retry
                          </button>
                        </div>
                      </div>
                    ) : gen.inputImage && gen.outputImage && showBeforeAfter ? (
                      <div className="w-full cursor-pointer" onClick={() => setFullView(gen)}>
                        <Comparison 
                          before={gen.inputImage} 
                          after={gen.outputImage} 
                          className="max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-200px)] w-full object-contain" 
                        />
                      </div>
                    ) : gen.outputImage ? (
                      <div className="relative w-full flex items-center justify-center min-h-[200px]">
                        {/* Loading overlay */}
                        {!loadedImages.has(gen.id) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-lg z-10">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                              <span className="text-xs text-zinc-600">Loading...</span>
                            </div>
                          </div>
                        )}
                        <img 
                          src={gen.outputImage} 
                          alt={gen.prompt} 
                          className="max-w-full max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-200px)] w-auto h-auto object-contain cursor-pointer"
                          onClick={() => setFullView(gen)}
                          loading="eager"
                          decoding="sync"
                          onLoad={() => handleImageLoaded(gen.id)}
                          onError={() => handleImageLoaded(gen.id)}
                        />
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Actions bar */}
                  {gen.outputImage && !gen.loading && (
                    <div className="px-4 py-3 flex items-center gap-2 border-t border-zinc-800/30">
                      <button
                        onClick={() => { useAsInput(gen.outputImage!); setMobileSheetExpanded(true); }}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors border",
                          gen.type === "upload" 
                            ? "bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border-violet-500/20"
                            : gen.type === "annotated"
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20"
                            : "bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 border-lime-400/20"
                        )}
                      >
                        {gen.type === "upload" || gen.type === "annotated" ? (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate from this
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            Edit this
                          </>
                        )}
                      </button>
                      <AnnotateButton
                        imageUrl={gen.outputImage}
                        onAnnotated={handleAnnotatedImage}
                        className="p-2.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-xl transition-colors border border-violet-500/20"
                      >
                        <Pencil className="w-4 h-4" />
                      </AnnotateButton>
                      <a href={gen.outputImage} download={`banana-${gen.id}.png`} target="_blank" rel="noopener noreferrer"
                        className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors" title="Download">
                        <Download className="w-4 h-4" />
                      </a>
                      <button onClick={() => handleDeleteGeneration(gen.id)}
                        className="p-2.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={historyEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* MOBILE: Bottom Sheet Controls */}
      {/* ============================================ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        {/* Backdrop when expanded */}
        {mobileSheetExpanded && (
          <div className="fixed inset-0 bg-black/60 -z-10" onClick={() => setMobileSheetExpanded(false)} />
        )}
        
        <div className={cn(
          "bg-zinc-900 border-t border-zinc-800 rounded-t-3xl transition-all duration-300 ease-out",
          mobileSheetExpanded ? "max-h-[85vh]" : "max-h-[140px]"
        )}>
          {/* Drag Handle */}
          <button 
            onClick={() => setMobileSheetExpanded(!mobileSheetExpanded)}
            className="w-full pt-3 pb-2 flex justify-center"
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full" />
          </button>

          {/* Collapsed: Compact Input Bar - Draggable to expand */}
          {!mobileSheetExpanded && (
            <div 
              className="px-4 pb-4"
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
            >
              <div className="flex items-center gap-2">
                {/* Image indicator/button */}
                <label className={cn(
                  "relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer overflow-hidden",
                  inputImages.length > 0 ? "border border-lime-400/30" : "bg-zinc-800 border border-zinc-700"
                )}>
                  {inputImages.length > 0 ? (
                    <>
                      <img src={inputImages[0]} alt="" className="w-full h-full object-cover" />
                      {inputImages.length > 1 && (
                        <span className="absolute -top-1 -right-1 bg-lime-500 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {inputImages.length}
                        </span>
                      )}
                    </>
                  ) : (
                    <ImageLucide className="w-4 h-4 text-zinc-500" />
                  )}
                  <input type="file" accept="image/*" multiple={true} onChange={handleFileSelect} className="hidden" />
                </label>
                
                {/* Prompt input */}
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={inputImages.length > 0 ? "Describe the edit..." : "Describe your image..."}
                  className="flex-1 h-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500/50"
                />
                
                {/* Generate button */}
                <button
                  onClick={() => { generate(); }}
                  disabled={!prompt.trim()}
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                    !prompt.trim() ? "bg-zinc-800 text-zinc-600" : "bg-lime-400 text-black"
                  )}
                >
                  {activeGenerations > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Expanded: Full Controls */}
          {mobileSheetExpanded && (
            <div className="px-4 pb-6 overflow-y-auto max-h-[calc(85vh-60px)]">
              {/* Active generations indicator */}
              {activeGenerations > 0 && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-lime-400/10 border border-lime-400/20 rounded-lg">
                  <Loader2 className="w-4 h-4 text-lime-400 animate-spin" />
                  <span className="text-xs text-lime-400">{activeGenerations} generating...</span>
                </div>
              )}

              {/* Main Input Area - Clean & Minimal */}
              <div className="mb-3">
                {/* Image + Prompt Row */}
                <div className="flex gap-3">
                  {/* Image thumbnail/upload */}
                  <label className={cn(
                    "relative flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                    inputImages.length > 0 ? "border-2 border-lime-400/30" : "bg-zinc-800 border-2 border-dashed border-zinc-700 hover:border-zinc-600"
                  )}>
                    {inputImages.length > 0 ? (
                      <>
                        <img src={inputImages[selectedImageIndex] || inputImages[0]} alt="" className="w-full h-full object-cover" />
                        {inputImages.length > 1 && (
                          <span className="absolute -top-1 -right-1 bg-lime-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                            {inputImages.length}
                          </span>
                        )}
                      </>
                    ) : (
                      <Upload className="w-5 h-5 text-zinc-500" />
                    )}
                    <input type="file" accept="image/*" multiple={true} onChange={handleFileSelect} className="hidden" />
                  </label>

                  {/* Prompt textarea */}
                  <div className="flex-1 relative">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={inputImages.length > 0 ? "Describe the edit..." : "Describe your image..."}
                      className="w-full h-16 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500/50 resize-none"
                    />
                    <button 
                      onClick={() => setShowPromptLibrary(true)} 
                      className="absolute bottom-2 right-2 p-1 text-zinc-500 hover:text-lime-400"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Image thumbnails for multi-image */}
                {inputImages.length > 1 && (
                  <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                    {inputImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIndex(i)}
                        className={cn(
                          "relative flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                          i === selectedImageIndex 
                            ? "border-lime-500" 
                            : "border-zinc-700 opacity-70"
                        )}
                      >
                        <img src={img} alt={`Input ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInputImages(prev => prev.filter((_, idx) => idx !== i));
                            if (selectedImageIndex >= inputImages.length - 1) {
                              setSelectedImageIndex(Math.max(0, inputImages.length - 2));
                            }
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}

                {/* Remove all images button */}
                {inputImages.length > 0 && (
                  <button 
                    onClick={() => { setInputImages([]); setSelectedImageIndex(0); }} 
                    className="mt-2 text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear all images
                  </button>
                )}
                
                {/* Select from history - mobile */}
                {(originalUploads.length > 0 || generations.filter(g => g.outputImage).length > 0) && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-zinc-400">Select from history</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Original uploads */}
                      {originalUploads.map((img, i) => (
                        <button
                          key={`upload-${i}`}
                          onClick={() => {
                            if (!inputImages.includes(img)) {
                              setInputImages(prev => [...prev, img]);
                            }
                          }}
                          className={cn(
                            "relative w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                            inputImages.includes(img)
                              ? "border-lime-500/50 opacity-50"
                              : "border-zinc-700 active:scale-95"
                          )}
                          disabled={inputImages.includes(img)}
                        >
                          <img src={img} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                          {!inputImages.includes(img) && (
                            <div className="absolute inset-0 bg-violet-500/30 flex items-center justify-center">
                              <Upload className="w-3 h-3 text-violet-200" />
                            </div>
                          )}
                        </button>
                      ))}
                      {/* Generated outputs */}
                      {generations.filter(g => g.outputImage).map((gen) => (
                        <button
                          key={`gen-${gen.id}`}
                          onClick={() => {
                            if (gen.outputImage && !inputImages.includes(gen.outputImage)) {
                              setInputImages(prev => [...prev, gen.outputImage!]);
                            }
                          }}
                          className={cn(
                            "relative w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                            inputImages.includes(gen.outputImage!)
                              ? "border-lime-500/50 opacity-50"
                              : "border-zinc-700 active:scale-95"
                          )}
                          disabled={inputImages.includes(gen.outputImage!)}
                        >
                          <img src={gen.outputImage} alt="Generated" className="w-full h-full object-cover" />
                          {!inputImages.includes(gen.outputImage!) && (
                            <div className="absolute inset-0 bg-lime-500/30 flex items-center justify-center">
                              <Sparkles className="w-3 h-3 text-lime-200" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Options */}
              <div className="space-y-2 mb-4">
                {/* Model Selector - Collapsed */}
                <button
                  onClick={() => setMobileShowModel(!mobileShowModel)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800/50 rounded-xl border border-zinc-700/50"
                >
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-lime-400" />
                    <span className="text-sm text-zinc-300">{MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}</span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", mobileShowModel && "rotate-180")} />
                </button>
                
                {mobileShowModel && (
                  <div className="grid grid-cols-2 gap-1.5 p-2 bg-zinc-800/30 rounded-xl">
                    {MODEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSelectedModel(opt.value);
                          if (opt.value === "google-nano-banana") setAspectRatio("match_input_image");
                          else if (opt.value === "nano-banana-pro") setAspectRatio("auto");
                          else if (opt.value === "seedream-edit") setImageSize("auto_4K");
                          else if (opt.value === "seedream") setImageSize("auto_2K");
                        }}
                        className={cn(
                          "px-2 py-2 rounded-lg text-center transition-colors",
                          selectedModel === opt.value
                            ? "bg-lime-400/20 border border-lime-400/30"
                            : "bg-zinc-800 border border-transparent"
                        )}
                      >
                        <p className={cn("text-xs font-medium truncate", selectedModel === opt.value ? "text-lime-400" : "text-white")}>
                          {opt.label}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Settings - Collapsed */}
                <button
                  onClick={() => setMobileShowSettings(!mobileShowSettings)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-800/50 rounded-xl border border-zinc-700/50"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm text-zinc-300">
                      {selectedModel === "seedream" || selectedModel === "seedream-edit" 
                        ? formatSizeLabel(imageSize) 
                        : selectedModel === "nano-banana-pro" 
                          ? `${aspectRatio} • ${resolution}` 
                          : aspectRatio}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", mobileShowSettings && "rotate-180")} />
                </button>

                {mobileShowSettings && (
                  <div className="p-3 bg-zinc-800/30 rounded-xl space-y-3">
                    {/* Seedream Text-to-Image: Image Size */}
                    {selectedModel === "seedream" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-10">Size</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {SEEDREAM_SIZES.slice(0, 6).map((size) => (
                            <button key={size} onClick={() => setImageSize(size as ImageSize)}
                              className={cn("px-2.5 py-1.5 text-xs rounded-lg transition-colors", imageSize === size ? "bg-lime-400 text-black font-medium" : "bg-zinc-700 text-zinc-400")}
                            >{formatSizeLabel(size)}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seedream Edit: Size Presets */}
                    {selectedModel === "seedream-edit" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-10">Size</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {SEEDREAM_EDIT_SIZES.slice(0, 6).map((size) => (
                            <button key={size} onClick={() => setImageSize(size as ImageSize)}
                              className={cn("px-2.5 py-1.5 text-xs rounded-lg transition-colors", imageSize === size ? "bg-lime-400 text-black font-medium" : "bg-zinc-700 text-zinc-400")}
                            >{formatSizeLabel(size)}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aspect Ratio */}
                    {(selectedModel === "nano-banana-pro" || selectedModel === "google-nano-banana") && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-10">Ratio</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {aspectRatioOptions.slice(0, 6).map((opt) => (
                            <button key={opt.value} onClick={() => setAspectRatio(opt.value as AspectRatio)}
                              className={cn("px-2.5 py-1.5 text-xs rounded-lg transition-colors", aspectRatio === opt.value ? "bg-lime-400 text-black font-medium" : "bg-zinc-700 text-zinc-400")}
                            >{opt.label}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolution */}
                    {selectedModel === "nano-banana-pro" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-10">Quality</span>
                        <div className="flex gap-1.5">
                          {["1K", "2K", "4K"].map((res) => (
                            <button key={res} onClick={() => setResolution(res as Resolution)}
                              className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors", resolution === res ? "bg-lime-400 text-black font-medium" : "bg-zinc-700 text-zinc-400")}
                            >{res}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Warning if model requires image but none provided */}
              {MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0 && (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-400">Add an image to use this model</span>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={() => { generate(); setMobileSheetExpanded(false); }}
                disabled={!prompt.trim() || (MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0)}
                className={cn(
                  "w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all",
                  !prompt.trim() || (MODEL_OPTIONS.find(m => m.value === selectedModel)?.requiresImageInput && inputImages.length === 0)
                    ? "bg-zinc-800 text-zinc-500" 
                    : "bg-lime-400 text-black active:scale-[0.98]"
                )}
              >
                <Sparkles className="w-5 h-5" />
                Generate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Prompt Library Modal */}
      <PromptLibrary
        isOpen={showPromptLibrary}
        onClose={() => setShowPromptLibrary(false)}
        onSelectPrompt={handleSelectPrompt}
      />

      {/* Full View Modal */}
      {fullView && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onClick={() => setFullView(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setFullView(null)}
            className="absolute top-3 right-3 lg:top-4 lg:right-4 w-10 h-10 bg-zinc-800/80 hover:bg-zinc-700 rounded-full flex items-center justify-center z-10 backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Image - maximized */}
          <div
            className="flex-1 flex items-center justify-center p-2 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {fullView.outputImage && (
              <img
                src={fullView.outputImage}
                alt={fullView.prompt}
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            )}
          </div>

          {/* Actions bar - compact */}
          <div className="flex-shrink-0 p-3 lg:p-4 flex items-center justify-center gap-2 lg:gap-3 bg-zinc-900/80 backdrop-blur-sm border-t border-zinc-800/50">
            <button
              onClick={() => {
                useAsInput(fullView.outputImage!);
                setFullView(null);
                if (window.innerWidth < 1024) {
                  setMobileSheetExpanded(true);
                }
              }}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-lime-400 text-black rounded-xl font-medium active:scale-[0.98] transition-all text-sm max-w-xs"
            >
              <ArrowRight className="w-4 h-4" />
              Edit this
            </button>
            {fullView.outputImage && (
              <AnnotateButton
                imageUrl={fullView.outputImage}
                onAnnotated={(annotatedUrl) => {
                  handleAnnotatedImage(annotatedUrl);
                  setFullView(null);
                }}
                className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-xl font-medium transition-colors text-sm max-w-xs border border-violet-500/20"
              >
                <Pencil className="w-4 h-4" />
                Annotate
              </AnnotateButton>
            )}
            <a
              href={fullView.outputImage}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors text-sm max-w-xs"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
