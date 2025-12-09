"use client";

import { useState, useCallback, useRef, useEffect, ChangeEvent, DragEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { saveGeneratedImage, getProject, getGeneratedImages, deleteGeneratedImage, type Project } from "@/lib/supabase";
import { PromptLibrary } from "@/components/prompt-library";
import { Comparison } from "@/components/ui/comparison";
import { Spinner, LoadingCard, ImageSkeleton } from "@/components/ui/spinner";
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
} from "lucide-react";

type AspectRatio = "auto" | "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "match_input_image";
type Resolution = "1K" | "2K";
type OutputFormat = "jpg" | "png" | "webp";
type ImageSize = "auto_2K" | "1K" | "2K" | "4K";
type ModelType = "nano-banana-pro" | "seedream" | "google-nano-banana";

const MODEL_OPTIONS: { value: ModelType; label: string; description: string; supportsImageInput: boolean }[] = [
  { value: "nano-banana-pro", label: "Nano Banana Pro", description: "FAL • Image editing", supportsImageInput: true },
  { value: "google-nano-banana", label: "Google Nano Banana", description: "Replicate • Fast & versatile", supportsImageInput: true },
  { value: "seedream", label: "Seedream 4.5", description: "FAL • Text to image only", supportsImageInput: false },
];

// Aspect ratios per model
const NANO_BANANA_PRO_RATIOS = ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const GOOGLE_NANO_RATIOS = ["match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const SEEDREAM_SIZES = ["auto_2K", "1K", "2K", "4K"];

type GenerationItem = {
  id: string;
  type: "generation";
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

  // Input state
  const [inputImage, setInputImage] = useState<string | null>(null);
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
  // Track which images have loaded in the browser
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  
  // Mark image as loaded when browser finishes loading it
  const handleImageLoaded = useCallback((id: string) => {
    setLoadedImages(prev => new Set(prev).add(id));
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
            
            // Pre-mark all existing images as "loaded" so they don't show loading spinner
            // (they'll re-validate on actual render via onLoad if needed)
            const existingIds = new Set(existingGenerations.filter(g => g.outputImage).map(g => g.id));
            setLoadedImages(existingIds);
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

  // File handling
  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setInputImage(e.target?.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Use generated image as input
  const useAsInput = useCallback((imageUrl: string) => {
    setInputImage(imageUrl);
  }, []);

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

    setError(null);

    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Capture current values for this generation
    const currentPrompt = prompt;
    const currentInputImage = inputImage;
    const currentAspectRatio = aspectRatio;
    const currentResolution = resolution;
    const currentOutputFormat = outputFormat;
    const currentImageSize = imageSize;
    const currentModel = selectedModel;

    // Add placeholder immediately
    const newGeneration: GenerationItem = {
      id,
      type: "generation",
      inputImage: currentInputImage || undefined,
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
          requestBody.imageInputs = currentInputImage ? [currentInputImage] : [];
          requestBody.aspectRatio = currentAspectRatio;
          requestBody.resolution = currentResolution;
        } else if (currentModel === "google-nano-banana") {
          requestBody.imageInputs = currentInputImage ? [currentInputImage] : [];
          requestBody.aspectRatio = currentAspectRatio;
        } else if (currentModel === "seedream") {
          // Seedream uses imageSize instead of aspectRatio, and no image inputs
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
  }, [prompt, inputImage, aspectRatio, resolution, outputFormat, imageSize, selectedModel, currentProject]);

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
    setInputImage(gen.inputImage || null);
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
        <div className="flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
            <span className="text-2xl">🍌</span>
          </div>
          
          {/* Spinner */}
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-lime-400 animate-spin" />
          </div>
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
                inputImage ? "bg-lime-400/10 border-lime-400/30" : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
              )}
              title="Upload image"
            >
              <Upload className={cn("w-5 h-5", inputImage ? "text-lime-400" : "text-zinc-500")} />
              <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
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
          {/* Input Image */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-300">Input Image</span>
              <span className="text-xs text-zinc-500">(optional)</span>
            </div>
            {inputImage ? (
              <div className="relative group">
                <img src={inputImage} alt="Input" className="w-full aspect-video object-cover rounded-xl border border-zinc-800" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                  <label className="p-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer transition-colors">
                    <RotateCcw className="w-4 h-4" />
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  </label>
                  <button onClick={() => setInputImage(null)} className="p-2 bg-white/10 hover:bg-red-500/50 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
                <p className="text-sm text-zinc-400">Drop image or click</p>
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </label>
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
                placeholder={inputImage ? "Describe how to edit this image..." : "Describe the image you want to create..."}
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
                            // Reset aspect ratio when changing models
                            if (opt.value === "google-nano-banana") {
                              setAspectRatio("match_input_image");
                            } else if (opt.value === "nano-banana-pro") {
                              setAspectRatio("auto");
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

                  {/* Seedream: Image Size */}
                  {selectedModel === "seedream" && (
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wide">Image Size</span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {SEEDREAM_SIZES.map((size) => (
                          <button key={size} onClick={() => setImageSize(size as ImageSize)}
                            className={cn("px-2 py-1 text-xs rounded-md transition-colors", imageSize === size ? "bg-lime-400 text-black font-medium" : "bg-zinc-800 text-zinc-400 hover:text-white")}
                          >{size === "auto_2K" ? "Auto 2K" : size}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nano Banana Pro / Google: Aspect Ratio */}
                  {selectedModel !== "seedream" && (
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
                        {["1K", "2K"].map((res) => (
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
            <button
              onClick={generate}
              disabled={!prompt.trim()}
              className={cn("w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all", !prompt.trim() ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-lime-400 text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20")}
            >
              <Sparkles className="w-5 h-5" />
              Generate
            </button>
          </div>
        </div>

        {sidebarCollapsed && (
          <div className="p-3 border-t border-white/5">
            <button onClick={generate} disabled={!prompt.trim()}
              className={cn("w-full p-3 rounded-xl transition-all flex items-center justify-center", !prompt.trim() ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-lime-400 text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20")}
              title="Generate"
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
        <div className="flex-1 overflow-y-auto p-4">
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
            <div className="max-w-2xl mx-auto space-y-4">
              {generations.map((gen) => (
                <div key={gen.id} className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-sm text-zinc-300 flex-1 line-clamp-2">{gen.prompt}</p>
                      <button onClick={() => copyPrompt(gen.prompt, gen.id)} className="p-1.5 text-zinc-600 hover:text-white transition-colors flex-shrink-0">
                        {copiedId === gen.id ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      {gen.loading ? (
                        <div className="min-h-[200px] bg-zinc-900 rounded-xl flex items-center justify-center relative overflow-hidden">
                          {/* Subtle shimmer */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-[shimmer_2s_infinite]" />
                          
                          <div className="flex flex-col items-center gap-4">
                            {/* Clean spinner */}
                            <div className="relative w-10 h-10">
                              <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-lime-400 animate-spin" />
                            </div>
                            
                            {/* Simple text */}
                            <p className="text-sm text-zinc-400">Generating...</p>
                          </div>
                        </div>
                      ) : gen.error ? (
                        <div className="min-h-[200px] bg-zinc-800 rounded-xl flex items-center justify-center">
                          <div className="text-center p-4">
                            <p className="text-red-400 mb-3 text-sm">{gen.error}</p>
                            <button onClick={() => retry(gen)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm flex items-center gap-2 mx-auto">
                              <RotateCcw className="w-4 h-4" />Retry
                            </button>
                          </div>
                        </div>
                      ) : gen.inputImage && gen.outputImage && showBeforeAfter ? (
                        <div className="cursor-pointer" onClick={() => setFullView(gen)}>
                          <Comparison before={gen.inputImage} after={gen.outputImage} className="rounded-xl" />
                        </div>
                      ) : gen.outputImage ? (
                        <div className={cn(
                          "relative bg-zinc-900 rounded-xl overflow-hidden",
                          !loadedImages.has(gen.id) && "min-h-[180px]"
                        )}>
                          {/* Loading state */}
                          {!loadedImages.has(gen.id) && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-900">
                              <div className="relative w-8 h-8">
                                <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-lime-400 animate-spin" />
                              </div>
                            </div>
                          )}
                          <img 
                            src={gen.outputImage} 
                            alt={gen.prompt} 
                            className={cn(
                              "w-full rounded-xl cursor-pointer block transition-opacity duration-300",
                              loadedImages.has(gen.id) ? "opacity-100" : "opacity-0"
                            )} 
                            onClick={() => setFullView(gen)}
                            loading="eager"
                            onLoad={() => handleImageLoaded(gen.id)}
                          />
                        </div>
                      ) : null}
                    </div>
                    {gen.outputImage && !gen.loading && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => { useAsInput(gen.outputImage!); setMobileSheetExpanded(true); }}
                          className="flex-1 py-2.5 bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-lime-400/20"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Edit this
                        </button>
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
                  <div className="px-3 py-2 bg-black/30 border-t border-zinc-800/50 flex items-center justify-between text-xs text-zinc-500">
                    <span>{gen.aspectRatio || "auto"} • {gen.settings?.resolution || "2K"}</span>
                    <span>{gen.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
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

          {/* Collapsed: Compact Input Bar */}
          {!mobileSheetExpanded && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2">
                {/* Image indicator/button */}
                <label className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer overflow-hidden",
                  inputImage ? "border border-lime-400/30" : "bg-zinc-800 border border-zinc-700"
                )}>
                  {inputImage ? (
                    <img src={inputImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageLucide className="w-4 h-4 text-zinc-500" />
                  )}
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
                
                {/* Prompt input */}
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onFocus={() => setMobileSheetExpanded(true)}
                  placeholder={inputImage ? "Describe the edit..." : "Describe your image..."}
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
                    "flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                    inputImage ? "border-2 border-lime-400/30" : "bg-zinc-800 border-2 border-dashed border-zinc-700 hover:border-zinc-600"
                  )}>
                    {inputImage ? (
                      <img src={inputImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-5 h-5 text-zinc-500" />
                    )}
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  </label>

                  {/* Prompt textarea */}
                  <div className="flex-1 relative">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={inputImage ? "Describe the edit..." : "Describe your image..."}
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

                {/* Remove image button */}
                {inputImage && (
                  <button 
                    onClick={() => setInputImage(null)} 
                    className="mt-2 text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Remove image
                  </button>
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
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-zinc-800/30 rounded-xl">
                    {MODEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSelectedModel(opt.value);
                          if (opt.value === "google-nano-banana") setAspectRatio("match_input_image");
                          else if (opt.value === "nano-banana-pro") setAspectRatio("auto");
                        }}
                        className={cn(
                          "px-2 py-2 rounded-lg text-center transition-colors",
                          selectedModel === opt.value
                            ? "bg-lime-400/20 border border-lime-400/30"
                            : "bg-zinc-800 border border-transparent"
                        )}
                      >
                        <p className={cn("text-xs font-medium truncate", selectedModel === opt.value ? "text-lime-400" : "text-white")}>
                          {opt.label.replace("Nano Banana", "Banana").replace("Seedream", "Seedream")}
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
                      {selectedModel === "seedream" ? imageSize : `${aspectRatio} • ${resolution}`}
                    </span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", mobileShowSettings && "rotate-180")} />
                </button>

                {mobileShowSettings && (
                  <div className="p-3 bg-zinc-800/30 rounded-xl space-y-3">
                    {/* Seedream: Image Size */}
                    {selectedModel === "seedream" && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 w-10">Size</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {SEEDREAM_SIZES.map((size) => (
                            <button key={size} onClick={() => setImageSize(size as ImageSize)}
                              className={cn("px-2.5 py-1.5 text-xs rounded-lg transition-colors", imageSize === size ? "bg-lime-400 text-black font-medium" : "bg-zinc-700 text-zinc-400")}
                            >{size === "auto_2K" ? "Auto" : size}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aspect Ratio */}
                    {selectedModel !== "seedream" && (
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
                          {["1K", "2K"].map((res) => (
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

              {/* Generate Button */}
              <button
                onClick={() => { generate(); setMobileSheetExpanded(false); }}
                disabled={!prompt.trim()}
                className={cn(
                  "w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all",
                  !prompt.trim() ? "bg-zinc-800 text-zinc-500" : "bg-lime-400 text-black active:scale-[0.98]"
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
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-2 lg:p-4"
          onClick={() => setFullView(null)}
        >
          <button
            onClick={() => setFullView(null)}
            className="absolute top-3 right-3 lg:top-4 lg:right-4 w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="max-w-5xl max-h-[75vh] lg:max-h-[85vh] w-full flex-1 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {fullView.outputImage && (
              <img
                src={fullView.outputImage}
                alt={fullView.prompt}
                className="max-w-full max-h-[70vh] lg:max-h-[80vh] mx-auto rounded-xl object-contain"
              />
            )}
          </div>

          <div className="mt-3 lg:mt-4 flex items-center justify-center gap-2 lg:gap-3 w-full px-4 lg:px-0">
            <button
              onClick={() => {
                useAsInput(fullView.outputImage!);
                setFullView(null);
                if (window.innerWidth < 1024) {
                  setMobileSheetExpanded(true);
                }
              }}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-lime-400 text-black rounded-xl font-medium active:scale-[0.98] transition-all text-sm"
            >
              <ArrowRight className="w-4 h-4" />
              Edit this
            </button>
            <a
              href={fullView.outputImage}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors text-sm"
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
