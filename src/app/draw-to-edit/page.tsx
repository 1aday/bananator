"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { saveGeneratedImage, getGeneratedImages, getProject, type Project } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import {
  MousePointer2,
  Pencil,
  Eraser,
  Square,
  ArrowRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Upload,
  Sparkles,
  Download,
  ChevronDown,
  Minus,
  X,
  Loader2,
  ZoomIn,
  FolderOpen,
} from "lucide-react";
import { Comparison } from "@/components/ui/comparison";

type Tool = "select" | "pen" | "eraser" | "rectangle" | "circle" | "arrow" | "text" | "line";
type DrawAction = {
  type: Tool;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
  color: string;
  lineWidth: number;
};

type GeneratedImage = {
  id: string;
  inputUrl: string;
  outputUrl: string;
  prompt: string;
};

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ffffff", // white
  "#000000", // black
];

export default function DrawToEdit() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  
  // Image state
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Drawing state
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  
  // History for undo/redo
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  
  // Text input
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  
  // Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [fullView, setFullView] = useState<GeneratedImage | null>(null);

  // Load project and project-scoped images on mount
  useEffect(() => {
    const loadProject = async () => {
      try {
        // Check for projectId in URL params or localStorage
        const projectIdFromUrl = searchParams.get("projectId");
        const projectIdFromStorage = localStorage.getItem("banana_current_project_id");
        const projectId = projectIdFromUrl || projectIdFromStorage;

        if (!projectId) {
          // No project selected, redirect to home
          router.push("/");
          return;
        }

        const project = await getProject(projectId);
        if (!project) {
          // Project not found, redirect to home
          router.push("/");
          return;
        }

        setCurrentProject(project);
        localStorage.setItem("banana_current_project_id", project.id);

        // Load project-scoped images
        const images = await getGeneratedImages(project.id, 20);
        if (images && images.length > 0) {
          const mapped = images.map((img) => ({
            id: img.id,
            inputUrl: (img.input_image_urls && img.input_image_urls[0]) || "",
            outputUrl: img.image_url,
            prompt: img.prompt,
          }));
          setGeneratedImages(mapped);
        }
      } catch (err) {
        console.error("Failed to load project:", err);
        router.push("/");
      } finally {
        setProjectLoading(false);
      }
    };
    loadProject();
  }, [searchParams, router]);

  // Draw everything on canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image if exists
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Draw placeholder grid
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw all actions
    actions.forEach((action) => {
      ctx.strokeStyle = action.color;
      ctx.fillStyle = action.color;
      ctx.lineWidth = action.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (action.type) {
        case "pen":
          if (action.points && action.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(action.points[0].x, action.points[0].y);
            action.points.forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          }
          break;
        case "eraser":
          if (action.points && action.points.length > 0) {
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.moveTo(action.points[0].x, action.points[0].y);
            action.points.forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.restore();
          }
          break;
        case "line":
          if (action.start && action.end) {
            ctx.beginPath();
            ctx.moveTo(action.start.x, action.start.y);
            ctx.lineTo(action.end.x, action.end.y);
            ctx.stroke();
          }
          break;
        case "rectangle":
          if (action.start && action.end) {
            ctx.strokeRect(
              action.start.x,
              action.start.y,
              action.end.x - action.start.x,
              action.end.y - action.start.y
            );
          }
          break;
        case "circle":
          if (action.start && action.end) {
            const radiusX = Math.abs(action.end.x - action.start.x) / 2;
            const radiusY = Math.abs(action.end.y - action.start.y) / 2;
            const centerX = action.start.x + (action.end.x - action.start.x) / 2;
            const centerY = action.start.y + (action.end.y - action.start.y) / 2;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.stroke();
          }
          break;
        case "arrow":
          if (action.start && action.end) {
            const headLength = 15;
            const dx = action.end.x - action.start.x;
            const dy = action.end.y - action.start.y;
            const angle = Math.atan2(dy, dx);
            
            // Draw line
            ctx.beginPath();
            ctx.moveTo(action.start.x, action.start.y);
            ctx.lineTo(action.end.x, action.end.y);
            ctx.stroke();
            
            // Draw arrowhead
            ctx.beginPath();
            ctx.moveTo(action.end.x, action.end.y);
            ctx.lineTo(
              action.end.x - headLength * Math.cos(angle - Math.PI / 6),
              action.end.y - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(action.end.x, action.end.y);
            ctx.lineTo(
              action.end.x - headLength * Math.cos(angle + Math.PI / 6),
              action.end.y - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;
        case "text":
          if (action.start && action.text) {
            ctx.font = `${action.lineWidth * 4}px sans-serif`;
            ctx.fillText(action.text, action.start.x, action.start.y);
          }
          break;
      }
    });

    // Draw current path while drawing
    if (isDrawing && currentPath.length > 0) {
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      if (tool === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
      }
      
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      
      if (tool === "eraser") {
        ctx.restore();
      }
    }

    // Draw shape preview
    if (isDrawing && startPoint && ["rectangle", "circle", "arrow", "line"].includes(tool)) {
      const lastPoint = currentPath[currentPath.length - 1] || startPoint;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([5, 5]);
      
      if (tool === "rectangle") {
        ctx.strokeRect(
          startPoint.x,
          startPoint.y,
          lastPoint.x - startPoint.x,
          lastPoint.y - startPoint.y
        );
      } else if (tool === "circle") {
        const radiusX = Math.abs(lastPoint.x - startPoint.x) / 2;
        const radiusY = Math.abs(lastPoint.y - startPoint.y) / 2;
        const centerX = startPoint.x + (lastPoint.x - startPoint.x) / 2;
        const centerY = startPoint.y + (lastPoint.y - startPoint.y) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === "arrow" || tool === "line") {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(lastPoint.x, lastPoint.y);
        ctx.stroke();
        
        if (tool === "arrow") {
          const headLength = 15;
          const dx = lastPoint.x - startPoint.x;
          const dy = lastPoint.y - startPoint.y;
          const angle = Math.atan2(dy, dx);
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(
            lastPoint.x - headLength * Math.cos(angle - Math.PI / 6),
            lastPoint.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(
            lastPoint.x - headLength * Math.cos(angle + Math.PI / 6),
            lastPoint.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }
  }, [actions, backgroundImage, color, currentPath, isDrawing, lineWidth, startPoint, tool]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Get mouse position relative to canvas
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    
    if (tool === "text") {
      setTextPosition(point);
      setShowTextInput(true);
      return;
    }
    
    setIsDrawing(true);
    setStartPoint(point);
    setCurrentPath([point]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const point = getCanvasPoint(e);
    setCurrentPath((prev) => [...prev, point]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "pen" || tool === "eraser") {
      if (currentPath.length > 0) {
        setActions((prev) => [
          ...prev,
          { type: tool, points: currentPath, color, lineWidth },
        ]);
        setRedoStack([]);
      }
    } else if (["rectangle", "circle", "arrow", "line"].includes(tool) && startPoint) {
      const endPoint = currentPath[currentPath.length - 1] || startPoint;
      setActions((prev) => [
        ...prev,
        { type: tool, start: startPoint, end: endPoint, color, lineWidth },
      ]);
      setRedoStack([]);
    }

    setCurrentPath([]);
    setStartPoint(null);
  };

  const handleTextSubmit = () => {
    if (textInput && textPosition) {
      setActions((prev) => [
        ...prev,
        { type: "text", start: textPosition, text: textInput, color, lineWidth },
      ]);
      setRedoStack([]);
    }
    setShowTextInput(false);
    setTextInput("");
    setTextPosition(null);
  };

  const handleUndo = () => {
    if (actions.length === 0) return;
    const lastAction = actions[actions.length - 1];
    setActions((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, lastAction]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setActions((prev) => [...prev, lastRedo]);
  };

  const handleClear = () => {
    setActions([]);
    setRedoStack([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      setBackgroundImage(img);
      // Adjust canvas size to image aspect ratio
      const maxWidth = 1200;
      const maxHeight = 800;
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
      }
      
      setCanvasSize({ width, height });
      setActions([]); // Clear drawings when new image is uploaded
      setRedoStack([]);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  const handleGenerate = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (!prompt.trim()) {
      alert("Please enter a prompt describing what changes you want");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Convert canvas to data URL (this includes the background + drawings)
      const dataUrl = canvas.toDataURL("image/png");
      
      // Call the generate API
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          imageInputs: [dataUrl], // API expects imageInputs array
          aspectRatio: "auto",
          resolution: "2K",
          numImages: 1,
          model: "nano-banana-pro",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      
      // API returns imageUrl directly, not images array
      if (data.imageUrl) {
        const generatedImageUrl = data.imageUrl;
        
        // Save to database with project association
        // Note: API already uploads to Supabase, so we use the URL directly
        const savedImage = await saveGeneratedImage({
          projectId: currentProject?.id || null,
          imageUrl: generatedImageUrl,
          prompt: prompt,
          inputImageUrls: [dataUrl],
          settings: {
            aspectRatio: "auto",
            resolution: "2K",
            outputFormat: "png",
            safetyFilter: "moderate",
          },
        });
        
        const newImage: GeneratedImage = {
          id: savedImage?.id || Date.now().toString(),
          inputUrl: dataUrl,
          outputUrl: generatedImageUrl,
          prompt: prompt,
        };
        setGeneratedImages(prev => [newImage, ...prev]);
      } else {
        throw new Error("No image URL returned from generation");
      }
    } catch (err) {
      console.error("Failed to generate:", err);
      alert(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement("a");
    link.download = "banana-drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadGeneratedImage = (url: string) => {
    const link = document.createElement("a");
    link.download = `banana-generated-${Date.now()}.png`;
    link.href = url;
    link.target = "_blank";
    link.click();
  };

  const tools = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "pen", icon: Pencil, label: "Pen" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "rectangle", icon: Square, label: "Rectangle" },
    { id: "arrow", icon: ArrowRight, label: "Arrow" },
    { id: "text", icon: Type, label: "Text" },
  ];

  // Show loading state while checking project
  if (projectLoading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🍌</span>
          </div>
          <Loader2 className="w-6 h-6 text-lime-400 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // If no image uploaded, show upload screen
  if (!backgroundImage) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <nav className="flex-shrink-0 bg-black/50 backdrop-blur-xl border-b border-white/5 relative z-[100]">
          <div className="max-w-[1920px] mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <span className="text-xl">🍌</span>
                  <span className="font-bold text-lg text-lime-400">Banana</span>
                </Link>
                
              </div>

              <div className="flex items-center gap-3">
                {currentProject && (
                  <Link
                    href={`/project/${currentProject.id}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-lime-400" />
                    <span className="text-white font-medium max-w-[150px] truncate">
                      {currentProject.name}
                    </span>
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-lime-400" />
                  <span className="text-sm font-medium text-white">Draw to Edit</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Upload Screen */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-zinc-800">
              <Upload className="w-10 h-10 text-zinc-600" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Upload an Image</h1>
            <p className="text-zinc-400 mb-8">
              Upload an image to start editing. Draw on your image and use AI to transform it.
            </p>
            
            <label className="inline-flex items-center gap-3 px-6 py-3 bg-lime-400 hover:bg-lime-300 text-black font-semibold rounded-xl cursor-pointer transition-colors">
              <Upload className="w-5 h-5" />
              <span>Choose Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
            
            <p className="text-zinc-500 text-sm mt-4">
              Supports PNG, JPG, WebP
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <nav className="flex-shrink-0 bg-black/50 backdrop-blur-xl border-b border-white/5 relative z-[100]">
        <div className="max-w-[1920px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="text-xl">🍌</span>
                <span className="font-bold text-lg text-lime-400">Banana</span>
              </Link>
              
            </div>

            <div className="flex items-center gap-3">
              {currentProject && (
                <Link
                  href={`/project/${currentProject.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-lime-400" />
                  <span className="text-white font-medium max-w-[150px] truncate">
                    {currentProject.name}
                  </span>
                </Link>
              )}
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-lime-400" />
                <span className="text-sm font-medium text-white">Draw to Edit</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
          <div 
            ref={containerRef}
            className="relative bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800"
            style={{ maxWidth: "100%", maxHeight: "calc(100vh - 200px)" }}
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="cursor-crosshair"
              style={{ 
                maxWidth: "100%", 
                maxHeight: "calc(100vh - 200px)",
                objectFit: "contain"
              }}
            />
            
            {/* Text input overlay */}
            {showTextInput && textPosition && (
              <div
                className="absolute"
                style={{ left: textPosition.x, top: textPosition.y }}
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTextSubmit();
                    if (e.key === "Escape") {
                      setShowTextInput(false);
                      setTextInput("");
                    }
                  }}
                  autoFocus
                  className="bg-transparent border-2 border-lime-400 text-white px-2 py-1 outline-none min-w-[100px]"
                  style={{ color, fontSize: `${lineWidth * 4}px` }}
                  placeholder="Type here..."
                />
              </div>
            )}

            {/* Loading overlay */}
            {isGenerating && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-lime-400 animate-spin mx-auto mb-3" />
                  <p className="text-white text-sm">Generating...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generated Images Sidebar */}
        {generatedImages.length > 0 && (
          <div className="w-80 bg-zinc-900/50 border-l border-zinc-800 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Generated ({generatedImages.length})</h3>
            <div className="space-y-3">
              {generatedImages.map((image) => (
                <div
                  key={image.id}
                  className="relative group rounded-lg overflow-hidden border border-zinc-700 hover:border-lime-500/50 transition-colors cursor-pointer"
                  onClick={() => setFullView(image)}
                >
                  <Comparison
                    firstImage={image.outputUrl}
                    secondImage={image.inputUrl}
                    className="aspect-video"
                    firstImageClassName="object-cover"
                    secondImageClassname="object-cover"
                    slideMode="hover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullView(image);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-white"
                      >
                        <ZoomIn className="w-3 h-3" />
                        View
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadGeneratedImage(image.outputUrl);
                        }}
                        className="flex items-center justify-center p-1 bg-zinc-800 hover:bg-zinc-700 rounded"
                      >
                        <Download className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Toolbar */}
      <div className="flex-shrink-0 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Upload & Model */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors border border-zinc-700">
                <Upload className="w-4 h-4 text-zinc-400" />
                <span className="text-sm text-zinc-300">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700">
                <span className="text-lime-400 text-sm font-medium">G</span>
                <span className="text-sm text-zinc-300">Nano Banana</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </div>
            </div>

            {/* Center: Tools */}
            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1 border border-zinc-700">
              {tools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id as Tool)}
                  className={cn(
                    "p-2 rounded-md transition-all",
                    tool === t.id
                      ? "bg-zinc-700 text-lime-400"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                  )}
                  title={t.label}
                >
                  <t.icon className="w-4 h-4" />
                </button>
              ))}
              
              {/* Divider */}
              <div className="w-px h-6 bg-zinc-700 mx-1" />
              
              {/* Colors */}
              <div className="flex items-center gap-0.5">
                {COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-5 h-5 rounded-full transition-all",
                      color === c ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-800" : ""
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              
              {/* Divider */}
              <div className="w-px h-6 bg-zinc-700 mx-1" />
              
              {/* Undo/Redo */}
              <button
                onClick={handleUndo}
                disabled={actions.length === 0}
                className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Generate & Actions */}
            <div className="flex items-center gap-2">
              {/* Prompt input */}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating) {
                    handleGenerate();
                  }
                }}
                placeholder="Describe the edit..."
                className="w-56 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
              />
              
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all",
                  isGenerating
                    ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                    : "bg-lime-400 text-black hover:bg-lime-300"
                )}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isGenerating ? "Generating..." : "Generate"}
              </button>
              
              {/* More actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLineWidth(lineWidth === 4 ? 8 : lineWidth === 8 ? 2 : 4)}
                  className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-all"
                  title={`Line width: ${lineWidth}px`}
                >
                  <div 
                    className="rounded-full bg-current" 
                    style={{ width: lineWidth + 4, height: lineWidth + 4 }}
                  />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-all"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClear}
                  className="p-2 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-700/50 transition-all"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full View Modal */}
      {fullView && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          onClick={() => setFullView(null)}
        >
          <button
            onClick={() => setFullView(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          
          <div 
            className="max-w-5xl max-h-[85vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Comparison
              firstImage={fullView.outputUrl}
              secondImage={fullView.inputUrl}
              className="w-full h-full rounded-xl overflow-hidden"
              firstImageClassName="object-contain"
              secondImageClassname="object-contain"
            />
            
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => downloadGeneratedImage(fullView.outputUrl)}
                className="flex items-center gap-2 px-4 py-2 bg-lime-400 text-black rounded-lg font-medium hover:bg-lime-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
