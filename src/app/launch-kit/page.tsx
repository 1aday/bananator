"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  Rocket,
  Sparkles,
  Target,
  Upload,
  Wand2,
  X,
} from "lucide-react";

type PlatformName = "tiktok" | "instagram" | "x" | "linkedin" | "email";

type PlatformKit = {
  name: PlatformName;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  notes: string;
};

type LaunchKit = {
  idea_summary: string;
  target_audience: string;
  goal: string;
  angle: string;
  voice: string;
  headline_options: string[];
  keywords: string[];
  visual_prompt: string;
  visual_style: string;
  platforms: PlatformKit[];
  email_blurb: string;
};

const PLATFORM_OPTIONS: { value: PlatformName; label: string; hint: string }[] = [
  { value: "tiktok", label: "TikTok", hint: "Hook + quick cuts" },
  { value: "instagram", label: "Instagram", hint: "Carousel/visual first" },
  { value: "x", label: "X", hint: "Punchy thread-able lines" },
  { value: "linkedin", label: "LinkedIn", hint: "Value + CTA" },
  { value: "email", label: "Email", hint: "Warm, concise blurb" },
];

const TONE_OPTIONS = ["Bold", "Helpful", "Analytical", "Playful", "Direct"];
const GOALS = ["Launch buzz", "Waitlist signups", "Sales/demo", "Newsletter growth"];
const VISUAL_STYLES = [
  "Cinematic product photo with practical lighting",
  "Clean 3D render with soft shadows",
  "Diagram/infographic with minimal color",
  "Lifestyle shot with real people using it",
  "High-contrast poster with strong typography",
];

const STARTER_IDEAS = [
  {
    emoji: "✨",
    title: "Clip-to-Reel App",
    idea: "Mobile app that turns phone videos into cinematic reels with music + captions.",
    audience: "Creators who batch film on weekends",
    goal: GOALS[0],
    tone: "Playful",
    style: "Cinematic product photo with practical lighting",
    platforms: ["tiktok", "instagram", "x"],
  },
  {
    emoji: "📚",
    title: "Study Buddy AI",
    idea: "Chat-based study buddy that creates mini quizzes and flashcards on any topic.",
    audience: "Students prepping for finals",
    goal: GOALS[1],
    tone: "Helpful",
    style: "Diagram/infographic with minimal color",
    platforms: ["instagram", "x", "linkedin", "email"],
  },
  {
    emoji: "🌿",
    title: "Calm Desk Kit",
    idea: "Desk setup bundle with soft lighting, plants, and cable-free charging.",
    audience: "Remote workers upgrading their home office",
    goal: GOALS[2],
    tone: "Direct",
    style: "Lifestyle shot with real people using it",
    platforms: ["instagram", "linkedin", "x"],
  },
];

export default function LaunchKitPage() {
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState(GOALS[0]);
  const [tone, setTone] = useState(TONE_OPTIONS[0]);
  const [style, setStyle] = useState(VISUAL_STYLES[0]);
  const [platforms, setPlatforms] = useState<PlatformName[]>(["tiktok", "instagram", "x", "linkedin"]);
  const [extras, setExtras] = useState("");
  const [kit, setKit] = useState<LaunchKit | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGeneratingKit, setIsGeneratingKit] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (kit) {
      const visual = `${kit.visual_prompt} | Style: ${kit.visual_style}`;
      setImagePrompt(visual);
    }
  }, [kit]);

  const togglePlatform = (value: PlatformName) => {
    setPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const applyStarter = (starter: (typeof STARTER_IDEAS)[number]) => {
    setIdea(starter.idea);
    setAudience(starter.audience);
    setGoal(starter.goal);
    setTone(starter.tone);
    setStyle(starter.style);
    setPlatforms(starter.platforms as PlatformName[]);
    setExtras("");
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setCopiedId(null);
    }
  };

  const handleReferenceUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setReferenceImage(event.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const generateKit = async () => {
    if (!idea.trim()) {
      setError("Tell me what you're launching first.");
      return;
    }
    setError(null);
    setIsGeneratingKit(true);
    setImageUrl(null);

    try {
      const response = await fetch("/api/launch-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          audience,
          goal,
          platforms,
          tone,
          style,
          extras,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to build kit");
      }

      setKit(data.kit);
      const promptText = `${data.kit.visual_prompt} | Style: ${data.kit.visual_style}`;
      setImagePrompt(promptText);
      await generateImage(promptText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to build launch kit");
    } finally {
      setIsGeneratingKit(false);
    }
  };

  const generateImage = async (promptText?: string) => {
    if (!promptText && !imagePrompt) {
      setError("No visual prompt yet. Generate a kit first.");
      return;
    }
    setError(null);
    setIsGeneratingImage(true);
    const model = referenceImage ? "nano-banana-pro" : "seedream";

    try {
      // Upload data URLs to Supabase before sending to API to prevent "request too large" errors
      let uploadedImageInputs: string[] = [];
      if (referenceImage) {
        const { uploadDataUrlToSupabase } = await import("@/lib/image-utils");
        try {
          uploadedImageInputs = [await uploadDataUrlToSupabase(referenceImage, "launch-kit")];
        } catch (error) {
          console.error("Failed to upload image, using original:", error);
          uploadedImageInputs = [referenceImage]; // Use original if upload fails
        }
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText || imagePrompt,
          imageInputs: uploadedImageInputs,
          model,
          aspectRatio: "16:9",
          resolution: "2K",
          imageSize: "auto_4K",
          numImages: 1,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setImageUrl(data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to render visual");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const buildPlatformText = (platform: PlatformKit) => {
    const tags = platform.hashtags?.length ? `\n${platform.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}` : "";
    return `${platform.hook}\n\n${platform.body}\n\nCTA: ${platform.cta}${tags}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white text-slate-900 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-64 w-64 bg-amber-200/50 blur-3xl" />
        <div className="absolute top-10 right-10 h-48 w-48 bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 h-32 w-96 bg-lime-200/40 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-8">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm border border-amber-200 shadow-sm">
              <Rocket className="w-4 h-4" />
              Launch Kit
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              Ship-ready campaigns in one shot
            </h1>
            <p className="text-slate-600 max-w-2xl mt-2">
              Drop your idea, pick platforms, and get copy plus a key visual you can paste anywhere.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-white/70 hover:border-amber-300 transition-colors text-sm text-slate-700 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to start
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {STARTER_IDEAS.map((starter) => (
            <button
              key={starter.title}
              onClick={() => applyStarter(starter)}
              className="group rounded-2xl border border-neutral-200 bg-white/80 p-4 text-left shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{starter.emoji}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  Quick start
                </span>
              </div>
              <p className="font-semibold text-slate-900">{starter.title}</p>
              <p className="text-sm text-slate-600 mt-1">{starter.idea}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {starter.tone} tone
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  {starter.goal}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white/70 p-4 shadow-sm flex flex-wrap gap-3 items-center">
          {[
            { label: "1. Idea", desc: "Add your product + goal" },
            { label: "2. Copy", desc: "Build multi-platform kit" },
            { label: "3. Visual", desc: "Render hero image" },
          ].map((step, idx) => (
            <div
              key={step.label}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.2)]"
            >
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-800 font-semibold flex items-center justify-center">
                {idx + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                <p className="text-xs text-slate-600">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr,1.35fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-amber-600">
                <Sparkles className="w-4 h-4" />
                <h2 className="font-semibold">Inputs</h2>
              </div>

              <div className="space-y-3">
                <label className="space-y-2 block">
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span>What are we launching?</span>
                    <span className="text-xs text-slate-500">Required</span>
                  </div>
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Example: Mobile app that turns phone videos into cinematic clips with music."
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm focus:ring-2 focus:ring-amber-300/70 outline-none min-h-[90px]"
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-2 block">
                    <span className="text-sm text-slate-700">Audience</span>
                    <input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="Creators who batch film on weekends"
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300/70 outline-none"
                    />
                  </label>
                  <label className="space-y-2 block">
                    <span className="text-sm text-slate-700">Goal</span>
                    <div className="grid grid-cols-2 gap-2">
                      {GOALS.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGoal(g)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm text-left transition-all",
                            goal === g
                              ? "border-amber-300 bg-amber-50 shadow-[0_6px_20px_-12px_rgba(249,115,22,0.6)]"
                              : "border-neutral-200 hover:border-neutral-300 bg-white"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <span className="text-sm text-slate-700">Platforms</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {PLATFORM_OPTIONS.map((platform) => {
                      const active = platforms.includes(platform.value);
                      return (
                        <button
                          key={platform.value}
                          onClick={() => togglePlatform(platform.value)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-left text-sm transition-all",
                            active
                              ? "border-amber-300 bg-amber-50 shadow-[0_6px_20px_-12px_rgba(249,115,22,0.6)]"
                              : "border-neutral-200 hover:border-neutral-300 bg-white"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span>{platform.label}</span>
                            {active && <Check className="w-3.5 h-3.5 text-amber-600" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{platform.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <span className="text-sm text-slate-700">Tone</span>
                    <div className="flex flex-wrap gap-2">
                      {TONE_OPTIONS.map((t) => {
                        const active = tone === t;
                        return (
                          <button
                            key={t}
                            onClick={() => setTone(t)}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-sm border transition-all",
                              active
                                ? "border-amber-300 bg-amber-50"
                                : "border-neutral-200 hover:border-neutral-300 bg-white"
                            )}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm text-slate-700">Visual direction</span>
                    <div className="space-y-2">
                      {VISUAL_STYLES.map((s) => {
                        const active = style === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setStyle(s)}
                              className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left text-sm transition-all",
                              active
                                ? "border-sky-300 bg-sky-50"
                                : "border-neutral-200 hover:border-neutral-300 bg-white"
                            )}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm text-slate-700">Extra constraints (optional)</span>
                  <input
                    value={extras}
                    onChange={(e) => setExtras(e.target.value)}
                    placeholder="Example: emphasize mobile-first, keep text under 80 words"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-300/70 outline-none"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={generateKit}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 text-white px-4 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg hover:-translate-y-px transition disabled:opacity-60"
                  disabled={isGeneratingKit || isGeneratingImage}
                >
                  {isGeneratingKit ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Build launch kit
                </button>

                <button
                  onClick={() => generateImage()}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm hover:border-amber-300 transition disabled:opacity-60 bg-white"
                  disabled={isGeneratingImage || (!kit && !imagePrompt)}
                >
                  {isGeneratingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 text-amber-600" />
                  )}
                  Refresh visual only
                </button>
              </div>

              {error && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-600" />
                  <h3 className="font-semibold">Key visual prompt</h3>
                </div>
                {referenceImage && (
                  <button
                    onClick={() => setReferenceImage(null)}
                    className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear reference
                  </button>
                )}
              </div>

              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Visual prompt will appear here after you build a kit."
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm focus:ring-2 focus:ring-sky-200 outline-none min-h-[120px]"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-sm hover:border-sky-300 transition bg-white"
                >
                  <Upload className="w-4 h-4" />
                  {referenceImage ? "Change reference image" : "Add reference image"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceUpload}
                  className="hidden"
                />
                {referenceImage && (
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-amber-50 px-3 py-2 text-xs text-slate-700">
                    <div className="w-10 h-10 overflow-hidden rounded-lg border border-neutral-200">
                      <img
                        src={referenceImage}
                        alt="Reference"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span>Using as guidance</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Target className="w-4 h-4" />
                  Launch summary
                </div>
                {kit && (
                  <div className="text-xs text-slate-500">
                    Voice: <span className="text-slate-800">{kit.voice}</span>
                  </div>
                )}
              </div>
              {kit ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-200 text-xs text-amber-800">
                      {kit.goal || goal}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-700 border border-slate-200">
                      {kit.target_audience || audience || "Target audience"}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-sky-100 border border-sky-200 text-xs text-sky-800">
                      {kit.angle}
                    </span>
                  </div>
                  <p className="text-lg font-semibold">{kit.idea_summary}</p>
                  <p className="text-slate-600">{kit.email_blurb}</p>
                  {kit.headline_options?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Headlines</p>
                      <div className="flex flex-wrap gap-2">
                        {kit.headline_options.map((h: string, idx: number) => (
                          <span
                            key={`${h}-${idx}`}
                            className="px-3 py-1 rounded-full bg-white border border-neutral-200 text-xs shadow-[0_6px_20px_-14px_rgba(15,23,42,0.35)]"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {kit.keywords?.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {kit.keywords.map((word: string) => (
                          <span
                            key={word}
                            className="px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-700 border border-slate-200"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  Build a launch kit to see the summary, angles, and headlines here.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-amber-50 p-4 md:p-5 relative overflow-hidden shadow-sm">
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_45%)]" />
              <div className="relative flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Wand2 className="w-4 h-4" />
                  Key visual
                </div>
                {imageUrl && (
                  <a
                    href={imageUrl}
                    download
                    className="text-xs text-slate-600 hover:text-slate-800 underline"
                  >
                    Download
                  </a>
                )}
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden min-h-[240px] flex items-center justify-center shadow-inner">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Generated visual"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-sm text-slate-500 gap-2 py-12">
                    {isGeneratingImage || isGeneratingKit ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                        <span>Rendering visual...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5" />
                        <span>Generate a kit to see your visual.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {imagePrompt && (
                <div className="relative mt-3 rounded-xl border border-neutral-200 bg-white p-3 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>Prompt used for this visual</span>
                    <button
                      onClick={() => handleCopy(imagePrompt, "visual-prompt")}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                    >
                      {copiedId === "visual-prompt" ? (
                        <Check className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Copy
                    </button>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                    {imagePrompt}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <Sparkles className="w-4 h-4" />
                Channel-ready copy
              </div>
              {kit ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {kit.platforms.map((platform, idx) => (
                    <div
                      key={`${platform.name}-${idx}`}
                      className="rounded-xl border border-neutral-200 bg-amber-50/40 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold capitalize text-slate-800">{platform.name}</p>
                          <p className="text-xs text-slate-500">{platform.notes}</p>
                        </div>
                        <button
                          onClick={() => handleCopy(buildPlatformText(platform), `${platform.name}-${idx}`)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                        >
                          {copiedId === `${platform.name}-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-slate-900">{platform.hook}</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{platform.body}</p>
                      <p className="text-sm text-amber-700">CTA: {platform.cta}</p>
                      {platform.hashtags?.length > 0 && (
                        <p className="text-xs text-slate-500">
                          #{platform.hashtags.map((tag) => tag.replace(/^#/, "")).join(" #")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">Your ready-to-paste copy will show up here.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
