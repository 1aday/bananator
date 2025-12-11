"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectSelector } from "@/components/project-selector";
import type { Project } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Sparkles, Palette, ArrowRight, Lightbulb, Wand2, Megaphone } from "lucide-react";

type Mode = "ideate" | "design" | null;

export default function Home() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<Mode>(null);

  // Check if there's a saved project and redirect
  useEffect(() => {
    const savedProjectId = localStorage.getItem("banana_current_project_id");
    if (savedProjectId) {
      // Optionally auto-redirect to last project
      // router.push(`/project/${savedProjectId}`);
    }
  }, [router]);

  const handleSelectProject = (project: Project) => {
    localStorage.setItem("banana_current_project_id", project.id);
    
    if (selectedMode === "design") {
      // Go to designer with project pre-selected
      localStorage.setItem("banana_designer_project_id", project.id);
      router.push(`/designer`);
    } else {
      // Go to normal image generation
      router.push(`/project/${project.id}`);
    }
  };

  // Mode selection screen
  if (!selectedMode) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🍌</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Welcome to Banana
            </h1>
            <p className="text-zinc-400 text-lg">
              What would you like to do today?
            </p>
          </div>

          {/* Mode Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Ideate Card */}
            <button
              onClick={() => setSelectedMode("ideate")}
              className={cn(
                "group relative p-6 sm:p-8 rounded-2xl border-2 text-left transition-all duration-300",
                "bg-gradient-to-br from-zinc-900 to-zinc-900/50",
                "border-zinc-800 hover:border-amber-500/50",
                "hover:shadow-lg hover:shadow-amber-500/10"
              )}
            >
              {/* Icon */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Lightbulb className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />
              </div>
              
              {/* Content */}
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                Ideate
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-4">
                Generate and explore AI images. Create variations, compare before & after, and build your visual library.
              </p>
              
              {/* Features */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full">
                  Image Generation
                </span>
                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full">
                  Before/After
                </span>
                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full">
                  Gallery
                </span>
              </div>
              
              {/* Decorative sparkles */}
              <Sparkles className="absolute top-4 right-4 w-5 h-5 text-amber-500/30 group-hover:text-amber-500/60 transition-colors" />
            </button>

            {/* Design Card */}
            <button
              onClick={() => setSelectedMode("design")}
              className={cn(
                "group relative p-6 sm:p-8 rounded-2xl border-2 text-left transition-all duration-300",
                "bg-gradient-to-br from-zinc-900 to-zinc-900/50",
                "border-zinc-800 hover:border-violet-500/50",
                "hover:shadow-lg hover:shadow-violet-500/10"
              )}
            >
              {/* Icon */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Palette className="w-7 h-7 sm:w-8 sm:h-8 text-violet-400" />
              </div>
              
              {/* Content */}
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                Design
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-4">
                AI-assisted interior design. Describe rooms, get structured design concepts, and render realistic visualizations.
              </p>
              
              {/* Features */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-violet-500/10 text-violet-400 text-xs font-medium rounded-full">
                  Room Design
                </span>
                <span className="px-2.5 py-1 bg-violet-500/10 text-violet-400 text-xs font-medium rounded-full">
                  AI Concepts
                </span>
                <span className="px-2.5 py-1 bg-violet-500/10 text-violet-400 text-xs font-medium rounded-full">
                  Rendering
                </span>
              </div>
              
              {/* Decorative wand */}
              <Wand2 className="absolute top-4 right-4 w-5 h-5 text-violet-500/30 group-hover:text-violet-500/60 transition-colors" />
            </button>

            {/* Launch Kit Card */}
            <button
              onClick={() => router.push("/launch-kit")}
              className={cn(
                "group relative p-6 sm:p-8 rounded-2xl border-2 text-left transition-all duration-300",
                "bg-gradient-to-br from-zinc-900 to-zinc-900/50",
                "border-zinc-800 hover:border-lime-500/60",
                "hover:shadow-lg hover:shadow-lime-500/10"
              )}
            >
              {/* Icon */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-lime-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Megaphone className="w-7 h-7 sm:w-8 sm:h-8 text-lime-300" />
              </div>
              
              {/* Content */}
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                Launch kit
                <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-lime-300 group-hover:translate-x-1 transition-all" />
              </h2>
              <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-4">
                Multi-platform promo pack with ready-to-paste copy plus a rendered hero visual.
              </p>
              
              {/* Features */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-lime-500/10 text-lime-300 text-xs font-medium rounded-full">
                  Platform copy
                </span>
                <span className="px-2.5 py-1 bg-lime-500/10 text-lime-300 text-xs font-medium rounded-full">
                  Visual prompt
                </span>
                <span className="px-2.5 py-1 bg-lime-500/10 text-lime-300 text-xs font-medium rounded-full">
                  Rendered hero
                </span>
              </div>
              
              {/* Decorative megaphone */}
              <Megaphone className="absolute top-4 right-4 w-5 h-5 text-lime-500/30 group-hover:text-lime-500/70 transition-colors" />
            </button>
          </div>

          {/* Subtle hint */}
          <p className="text-center text-zinc-600 text-sm mt-8">
            You can switch between modes anytime
          </p>
        </div>
      </div>
    );
  }

  // Project selection screen
  return (
    <ProjectSelector
      onSelectProject={handleSelectProject}
      currentProjectId={null}
      mode={selectedMode}
      onBack={() => setSelectedMode(null)}
    />
  );
}
