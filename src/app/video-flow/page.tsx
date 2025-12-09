"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase, createVideoFlow, updateVideoFlow, getVideoFlows, getProject, type VideoFlow, type Project } from "@/lib/supabase";
import {
  Upload,
  Sparkles,
  X,
  Loader2,
  Download,
  ChevronDown,
  Lock,
  RefreshCw,
  Video,
  Check,
  ArrowRight,
  ImageIcon,
  Play,
  FolderOpen,
  History,
  Pencil,
} from "lucide-react";

type Step = "choose" | "upload" | "generate" | "video";
type FlowMode = "before-to-after" | "after-to-before";

type FlowState = {
  mode: FlowMode | null;
  uploadedImage: string | null;
  generatedImage: string | null;
  locked: boolean;
  videoUrl: string | null;
  prompt: string;
  dbRecord: VideoFlow | null;
};

export default function VideoFlowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [previousFlows, setPreviousFlows] = useState<VideoFlow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const [currentStep, setCurrentStep] = useState<Step>("choose");
  const [flowState, setFlowState] = useState<FlowState>({
    mode: null,
    uploadedImage: null,
    generatedImage: null,
    locked: false,
    videoUrl: null,
    prompt: "",
    dbRecord: null,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load project on mount
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

        // Load previous video flows for this project
        const flows = await getVideoFlows(project.id, 20);
        setPreviousFlows(flows || []);
      } catch (err) {
        console.error("Failed to load project:", err);
        router.push("/");
      } finally {
        setProjectLoading(false);
      }
    };
    loadProject();
  }, [searchParams, router]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setFlowState((prev) => ({
        ...prev,
        uploadedImage: event.target?.result as string,
      }));
      setCurrentStep("generate");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const selectMode = (mode: FlowMode) => {
    setFlowState((prev) => ({
      ...prev,
      mode,
    }));
    setCurrentStep("upload");
  };

  const generateImage = async () => {
    if (!flowState.uploadedImage || !flowState.prompt.trim()) {
      setError("Please upload an image and enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: flowState.prompt,
          imageInputs: [flowState.uploadedImage],
          aspectRatio: "auto",
          resolution: "2K",
          numImages: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();

      if (data.imageUrl) {
        setFlowState((prev) => ({
          ...prev,
          generatedImage: data.imageUrl,
        }));
      }
    } catch (err) {
      console.error("Failed to generate:", err);
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const lockImages = async () => {
    if (!flowState.uploadedImage || !flowState.generatedImage) return;

    try {
      // Upload images to get public URLs
      const uploadImage = async (dataUrl: string, name: string) => {
        if (!dataUrl.startsWith("data:")) return dataUrl;
        
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const fileName = `video-flow/${Date.now()}-${name}.png`;

        const { error: uploadError } = await supabase.storage
          .from("generated-images")
          .upload(fileName, blob, {
            contentType: "image/png",
            cacheControl: "3600",
          });

        if (uploadError) {
          throw new Error(`Failed to upload ${name} image: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from("generated-images")
          .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
      };

      const uploadedUrl = await uploadImage(flowState.uploadedImage, "uploaded");
      const generatedUrl = await uploadImage(flowState.generatedImage, "generated");

      // Determine before/after based on mode
      const beforeUrl = flowState.mode === "before-to-after" ? uploadedUrl : generatedUrl;
      const afterUrl = flowState.mode === "before-to-after" ? generatedUrl : uploadedUrl;

      // Save to database with project association
      const dbRecord = await createVideoFlow({
        projectId: currentProject?.id || null,
        beforeImageUrl: beforeUrl,
        afterImageUrl: afterUrl,
        prompt: flowState.prompt,
      });
      
      // Update previous flows list
      setPreviousFlows(prev => [dbRecord, ...prev]);

      setFlowState((prev) => ({
        ...prev,
        uploadedImage: uploadedUrl,
        generatedImage: generatedUrl,
        locked: true,
        dbRecord: dbRecord,
      }));
      setCurrentStep("video");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Failed to save flow:", errorMessage);
      setError(errorMessage || "Failed to save. Please try again.");
    }
  };

  const retryGeneration = () => {
    setFlowState((prev) => ({
      ...prev,
      generatedImage: null,
    }));
  };

  const generateVideo = async () => {
    if (!flowState.uploadedImage || !flowState.generatedImage) {
      setError("Both images are required");
      return;
    }

    setIsGeneratingVideo(true);
    setVideoProgress("Submitting...");
    setError(null);

    // Update status in database
    if (flowState.dbRecord) {
      await updateVideoFlow(flowState.dbRecord.id, { status: "generating" });
    }

    try {
      // Determine first/last frame based on mode
      // before-to-after: uploaded is before (first), generated is after (last)
      // after-to-before: uploaded is after (last), generated is before (first)
      const firstFrameUrl = flowState.mode === "before-to-after" 
        ? flowState.uploadedImage 
        : flowState.generatedImage;
      const lastFrameUrl = flowState.mode === "before-to-after" 
        ? flowState.generatedImage 
        : flowState.uploadedImage;

      // Submit video generation job
      setVideoProgress("Starting video generation...");
      const submitResponse = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstFrameUrl,
          lastFrameUrl,
          prompt: "make a timelapse of this construction, camera stays stationary",
          duration: "8s",
          aspectRatio: "auto",
          resolution: "720p",
          generateAudio: false,
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        throw new Error(errorData.error || "Failed to submit video generation");
      }

      const submitData = await submitResponse.json();
      const requestId = submitData.requestId;

      if (!requestId) {
        throw new Error("No request ID returned");
      }

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max (5s intervals)
      const pollInterval = 5000; // 5 seconds

      setVideoProgress("Queued for processing...");

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const statusResponse = await fetch(`/api/generate-video?requestId=${requestId}`);
        
        if (!statusResponse.ok) {
          attempts++;
          continue;
        }

        const statusData = await statusResponse.json();

        // Update progress message based on status
        if (statusData.status === "IN_QUEUE") {
          setVideoProgress("Waiting in queue...");
        } else if (statusData.status === "IN_PROGRESS") {
          const elapsed = Math.floor((attempts * pollInterval) / 1000);
          setVideoProgress(`Generating video... (${elapsed}s)`);
        }

        if (statusData.status === "COMPLETED" && statusData.video?.url) {
          // Update database with video URL
          if (flowState.dbRecord) {
            await updateVideoFlow(flowState.dbRecord.id, {
              videoUrl: statusData.video.url,
              status: "completed",
            });
          }

          setFlowState((prev) => ({
            ...prev,
            videoUrl: statusData.video.url,
          }));
          return; // Success!
        } else if (statusData.status === "FAILED") {
          throw new Error("Video generation failed");
        }

        // Still processing (IN_QUEUE or IN_PROGRESS)
        attempts++;
      }

      // Timeout after max attempts
      throw new Error("Video generation timed out. Please try again.");
    } catch (err) {
      console.error("Failed to generate video:", err);
      
      // Update status to failed
      if (flowState.dbRecord) {
        await updateVideoFlow(flowState.dbRecord.id, { status: "failed" });
      }
      
      setError(err instanceof Error ? err.message : "Failed to generate video");
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress("");
    }
  };

  const resetFlow = () => {
    setFlowState({
      mode: null,
      uploadedImage: null,
      generatedImage: null,
      locked: false,
      videoUrl: null,
      prompt: "",
      dbRecord: null,
    });
    setCurrentStep("choose");
    setError(null);
  };

  const downloadVideo = () => {
    if (!flowState.videoUrl) return;
    const link = document.createElement("a");
    link.href = flowState.videoUrl;
    link.download = `timelapse-${Date.now()}.mp4`;
    link.target = "_blank";
    link.click();
  };

  const steps = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "generate", label: "Generate", icon: Sparkles },
    { id: "video", label: "Video", icon: Video },
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-[100] bg-black/50 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1920px] mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="text-xl">🍌</span>
                <span className="font-bold text-lg text-lime-400">Banana</span>
              </Link>
              
              {/* Main Nav */}
              <div className="hidden md:flex items-center gap-1 text-sm">
                <Link href="/" className="px-3 py-1.5 font-medium rounded-lg text-zinc-500 hover:text-white transition-colors">
                  Explore
                </Link>
                
                {/* Image Dropdown */}
                <div className="relative group/dropdown">
                  <button className="px-3 py-1.5 font-medium rounded-lg text-lime-400 transition-colors flex items-center gap-1">
                    Image
                    <ChevronDown className="w-3 h-3 opacity-50 group-hover/dropdown:opacity-100 transition-opacity" />
                  </button>
                  
                  <div className="absolute -left-2 top-0 pt-10 opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all duration-150 z-50">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/80 p-2 min-w-[240px]">
                      <div className="space-y-1">
                        <Link href={currentProject ? `/project/${currentProject.id}` : "/"} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors text-left group/item">
                          <div className="w-8 h-8 bg-zinc-800 group-hover/item:bg-zinc-700 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-lime-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white text-sm">Create Image</div>
                            <div className="text-xs text-zinc-500">Generate AI images</div>
                          </div>
                        </Link>
                        <Link href={currentProject ? `/draw-to-edit?projectId=${currentProject.id}` : "/draw-to-edit"} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors text-left group/item">
                          <div className="w-8 h-8 bg-zinc-800 group-hover/item:bg-zinc-700 rounded-lg flex items-center justify-center">
                            <Pencil className="w-4 h-4 text-lime-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm">Draw to Edit</span>
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-lime-400 text-black rounded uppercase">New</span>
                            </div>
                            <div className="text-xs text-zinc-500">Draw & annotate images</div>
                          </div>
                        </Link>
                        <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800 text-left">
                          <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                            <Video className="w-4 h-4 text-lime-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm">Video Flow</span>
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-lime-400 text-black rounded uppercase">New</span>
                            </div>
                            <div className="text-xs text-zinc-500">Create timelapse videos</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button className="px-3 py-1.5 font-medium rounded-lg text-zinc-500 hover:text-white transition-colors">
                  Video
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
              {previousFlows.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showHistory ? "bg-lime-400/20 text-lime-400" : "text-zinc-400 hover:text-white"
                  )}
                  title="Previous videos"
                >
                  <History className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* History Panel */}
      {showHistory && previousFlows.length > 0 && (
        <div className="max-w-lg mx-auto px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
          <h3 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Previous Videos</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {previousFlows.map((flow) => (
              <div
                key={flow.id}
                className="flex-shrink-0 w-28 rounded-lg overflow-hidden border border-zinc-700 hover:border-lime-500/50 transition-colors cursor-pointer"
                onClick={() => {
                  if (flow.video_url) {
                    // For loaded flows, we don't know the original mode
                    // so we'll default to before-to-after since we have both images
                    setFlowState({
                      mode: "before-to-after",
                      uploadedImage: flow.before_image_url,
                      generatedImage: flow.after_image_url,
                      locked: true,
                      videoUrl: flow.video_url,
                      prompt: flow.prompt,
                      dbRecord: flow,
                    });
                    setCurrentStep("video");
                    setShowHistory(false);
                  }
                }}
              >
                <div className="aspect-video relative">
                  <img
                    src={flow.after_image_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  {flow.status === "completed" && flow.video_url && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {flow.status === "generating" && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-lime-400 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="p-1.5 bg-zinc-800">
                  <p className="text-[10px] text-zinc-400 truncate">{flow.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Steps - Only show after mode is chosen */}
      {currentStep !== "choose" && (
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      currentStep === step.id
                        ? "bg-lime-400 text-black"
                        : steps.findIndex((s) => s.id === currentStep) > index
                        ? "bg-lime-400/20 text-lime-400"
                        : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {steps.findIndex((s) => s.id === currentStep) > index ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-1.5 font-medium",
                      currentStep === step.id ? "text-lime-400" : "text-zinc-500"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 -mt-5",
                      steps.findIndex((s) => s.id === currentStep) > index
                        ? "bg-lime-400/50"
                        : "bg-zinc-800"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pb-24">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-300">
              ✕
            </button>
          </div>
        )}

        {/* Step 0: Choose Mode */}
        {currentStep === "choose" && (
          <div className="space-y-4 pt-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Create a Timelapse Video</h2>
              <p className="text-zinc-400 text-sm">
                Which image do you have? We'll generate the other one.
              </p>
            </div>

            <div className="grid gap-4">
              <button
                onClick={() => selectMode("before-to-after")}
                className="p-5 bg-zinc-900 border border-zinc-700 rounded-2xl hover:border-lime-500/50 hover:bg-zinc-800/50 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-zinc-800 group-hover:bg-lime-400/20 rounded-xl flex items-center justify-center transition-colors">
                    <ImageIcon className="w-7 h-7 text-lime-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">I have the "Before" image</h3>
                    <p className="text-sm text-zinc-400">Upload your starting image and we'll generate what it looks like after</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-lime-400 transition-colors" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="px-2 py-1 bg-zinc-800 rounded">Upload Before</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="px-2 py-1 bg-lime-400/20 text-lime-400 rounded">Generate After</span>
                </div>
              </button>

              <button
                onClick={() => selectMode("after-to-before")}
                className="p-5 bg-zinc-900 border border-zinc-700 rounded-2xl hover:border-lime-500/50 hover:bg-zinc-800/50 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-zinc-800 group-hover:bg-lime-400/20 rounded-xl flex items-center justify-center transition-colors">
                    <Sparkles className="w-7 h-7 text-lime-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">I have the "After" image</h3>
                    <p className="text-sm text-zinc-400">Upload your final image and we'll generate what it looked like before</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-lime-400 transition-colors" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="px-2 py-1 bg-zinc-800 rounded">Upload After</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="px-2 py-1 bg-lime-400/20 text-lime-400 rounded">Generate Before</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Upload Image */}
        {currentStep === "upload" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-2">
                Upload {flowState.mode === "before-to-after" ? "Before" : "After"} Image
              </h2>
              <p className="text-zinc-400 text-sm">
                {flowState.mode === "before-to-after" 
                  ? "Start with your \"before\" photo - this will be the first frame"
                  : "Start with your \"after\" photo - this will be the last frame"}
              </p>
            </div>

            {!flowState.uploadedImage ? (
              <label className="block cursor-pointer">
                <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-zinc-700 hover:border-lime-500/50 transition-colors flex flex-col items-center justify-center gap-3 bg-zinc-900/50">
                  <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center">
                    <Upload className="w-8 h-8 text-zinc-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-zinc-300 font-medium">Tap to upload</p>
                    <p className="text-zinc-500 text-sm">PNG, JPG up to 10MB</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900">
                  <img
                    src={flowState.uploadedImage}
                    alt={flowState.mode === "before-to-after" ? "Before" : "After"}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded-lg text-xs text-zinc-300">
                    {flowState.mode === "before-to-after" ? "Before" : "After"}
                  </div>
                  <button
                    onClick={() =>
                      setFlowState((prev) => ({ ...prev, uploadedImage: null }))
                    }
                    className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setCurrentStep("generate")}
                  className="w-full py-3 bg-lime-400 text-black font-semibold rounded-xl hover:bg-lime-300 transition-colors flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Back Button */}
            <button
              onClick={() => {
                setFlowState((prev) => ({ ...prev, mode: null, uploadedImage: null }));
                setCurrentStep("choose");
              }}
              className="w-full py-2 text-zinc-500 hover:text-white text-sm transition-colors"
            >
              ← Back to choose mode
            </button>
          </div>
        )}

        {/* Step 2: Generate Image */}
        {currentStep === "generate" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-2">
                Create {flowState.mode === "before-to-after" ? "After" : "Before"} Image
              </h2>
              <p className="text-zinc-400 text-sm">
                {flowState.mode === "before-to-after"
                  ? "Describe how you want the \"after\" to look"
                  : "Describe how it looked \"before\""}
              </p>
            </div>

            {/* Uploaded Image Preview */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
              <img
                src={flowState.uploadedImage!}
                alt={flowState.mode === "before-to-after" ? "Before" : "After"}
                className="w-full h-full object-contain opacity-50"
              />
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded-lg text-xs text-zinc-300">
                {flowState.mode === "before-to-after" ? "Before (uploaded)" : "After (uploaded)"}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-3">
              <textarea
                value={flowState.prompt}
                onChange={(e) =>
                  setFlowState((prev) => ({ ...prev, prompt: e.target.value }))
                }
                placeholder={flowState.mode === "before-to-after"
                  ? "Describe the transformation... e.g., 'complete the construction with a modern building'"
                  : "Describe how it looked before... e.g., 'an empty lot with just grass and some trees'"}
                className="w-full h-24 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 resize-none"
              />

              <button
                onClick={generateImage}
                disabled={isGenerating || !flowState.prompt.trim()}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                  isGenerating || !flowState.prompt.trim()
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-lime-400 text-black hover:bg-lime-300"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate {flowState.mode === "before-to-after" ? "After" : "Before"}
                  </>
                )}
              </button>
            </div>

            {/* Generated Image */}
            {flowState.generatedImage && (
              <div className="space-y-3 mt-6">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
                  <img
                    src={flowState.generatedImage}
                    alt={flowState.mode === "before-to-after" ? "After" : "Before"}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 bg-lime-400 rounded-lg text-xs text-black font-medium">
                    {flowState.mode === "before-to-after" ? "After (generated)" : "Before (generated)"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={retryGeneration}
                    disabled={flowState.locked}
                    className="py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                  <button
                    onClick={lockImages}
                    className="py-3 bg-lime-400 text-black font-semibold rounded-xl hover:bg-lime-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Lock & Continue
                  </button>
                </div>
              </div>
            )}

            {/* Back Button */}
            <button
              onClick={() => setCurrentStep("upload")}
              className="w-full py-2 text-zinc-500 hover:text-white text-sm transition-colors"
            >
              ← Back to Upload
            </button>
          </div>
        )}

        {/* Step 3: Generate Video */}
        {currentStep === "video" && (() => {
          // Show images in the order they'll appear in the video
          const firstFrame = flowState.mode === "before-to-after" 
            ? flowState.uploadedImage 
            : flowState.generatedImage;
          const lastFrame = flowState.mode === "before-to-after" 
            ? flowState.generatedImage 
            : flowState.uploadedImage;
          return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-2">Create Timelapse Video</h2>
              <p className="text-zinc-400 text-sm">
                We'll animate the transformation between your images
              </p>
            </div>

            {/* Before & After Preview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
                <img
                  src={firstFrame!}
                  alt="Before"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-lg text-xs text-zinc-300">
                  Before
                </div>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
                <img
                  src={lastFrame!}
                  alt="After"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-lime-400 rounded-lg text-xs text-black font-medium">
                  After
                </div>
              </div>
            </div>

            {/* Video Generation */}
            {!flowState.videoUrl ? (
              <div className="space-y-3">
                <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Video className="w-5 h-5 text-lime-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Timelapse Video
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        8 seconds • 720p • No audio
                      </p>
                      <p className="text-xs text-zinc-400 mt-2 italic">
                        "make a timelapse of this construction, camera stays stationary"
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={generateVideo}
                  disabled={isGeneratingVideo}
                  className={cn(
                    "w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                    isGeneratingVideo
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-lime-400 text-black hover:bg-lime-300"
                  )}
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <div className="text-left">
                        <p>{videoProgress || "Generating Video..."}</p>
                        <p className="text-xs opacity-70">This may take 2-5 minutes</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Generate Timelapse
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900">
                  <video
                    src={flowState.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={downloadVideo}
                    className="py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={resetFlow}
                    className="py-3 bg-lime-400 text-black font-semibold rounded-xl hover:bg-lime-300 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Start Over
                  </button>
                </div>
              </div>
            )}

            {/* Back Button */}
            {!flowState.videoUrl && (
              <button
                onClick={() => {
                  setFlowState((prev) => ({ ...prev, locked: false }));
                  setCurrentStep("generate");
                }}
                className="w-full py-2 text-zinc-500 hover:text-white text-sm transition-colors"
              >
                ← Back to Edit
              </button>
            )}
          </div>
          );
        })()}
      </main>

      {/* Success/Complete State */}
      {flowState.videoUrl && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 to-transparent">
          <div className="max-w-lg mx-auto">
            <div className="p-4 bg-lime-400/10 border border-lime-400/20 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-lime-400 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="text-lime-400 font-medium">Video Ready!</p>
                <p className="text-zinc-400 text-sm">
                  Your timelapse has been generated
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
