"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  getPromptCategories,
  getPromptTemplates,
  incrementPromptUseCount,
  createPromptTemplate,
} from "@/lib/supabase";
import type { PromptCategory, PromptTemplate } from "@/lib/database.types";
import {
  BookOpen,
  Search,
  ChevronRight,
  Sparkles,
  TrendingUp,
  X,
  Loader2,
  Plus,
} from "lucide-react";

interface PromptLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export function PromptLibrary({
  isOpen,
  onClose,
  onSelectPrompt,
}: PromptLibraryProps) {
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"categories" | "popular">(
    "categories"
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: "",
    prompt: "",
    categoryId: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [categoriesData, templatesData] = await Promise.all([
        getPromptCategories(),
        getPromptTemplates(),
      ]);
      setCategories(categoriesData || []);
      setTemplates(templatesData || []);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; details?: string };
      console.error("Error loading prompt library:", err.message || err.code || JSON.stringify(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPrompt = async (template: PromptTemplate) => {
    onSelectPrompt(template.prompt);
    try {
      await incrementPromptUseCount(template.id);
    } catch (error) {
      console.error("Error incrementing use count:", error);
    }
    onClose();
  };

  const handleSaveNewPrompt = async () => {
    if (!newPrompt.name || !newPrompt.prompt || !newPrompt.categoryId) return;
    
    setIsSaving(true);
    try {
      await createPromptTemplate({
        name: newPrompt.name,
        prompt: newPrompt.prompt,
        categoryId: newPrompt.categoryId,
        description: newPrompt.description || undefined,
      });
      // Reload templates
      const templatesData = await getPromptTemplates();
      setTemplates(templatesData || []);
      // Reset form
      setNewPrompt({ name: "", prompt: "", categoryId: "", description: "" });
      setShowAddForm(false);
    } catch (error) {
      console.error("Error saving prompt:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      searchQuery === "" ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.prompt.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === null || t.category_id === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const popularTemplates = [...templates]
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, 10);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-500/10 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-lime-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Prompt Library
              </h2>
              <p className="text-sm text-zinc-400">
                Choose a style to enhance your prompt
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={cn(
                "px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors",
                showAddForm
                  ? "bg-lime-500 text-black"
                  : "bg-zinc-800 hover:bg-zinc-700 text-white"
              )}
            >
              <Plus className="w-4 h-4" />
              Add Prompt
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="p-4 border-b border-zinc-800 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-black/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("categories");
                setSelectedCategory(null);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "categories"
                  ? "bg-lime-500/20 text-lime-400 border border-lime-500/30"
                  : "bg-zinc-900 text-zinc-400 hover:text-white"
              )}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Categories
              </span>
            </button>
            <button
              onClick={() => setActiveTab("popular")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "popular"
                  ? "bg-lime-500/20 text-lime-400 border border-lime-500/30"
                  : "bg-zinc-900 text-zinc-400 hover:text-white"
              )}
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Popular
              </span>
            </button>
          </div>
        </div>

        {/* Add New Prompt Form */}
        {showAddForm && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Cinematic Lighting"
                  value={newPrompt.name}
                  onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                  className="w-full px-4 py-2 bg-black/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Category *</label>
                <select
                  value={newPrompt.categoryId}
                  onChange={(e) => setNewPrompt({ ...newPrompt, categoryId: e.target.value })}
                  className="w-full px-4 py-2 bg-black/50 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-lime-500/50"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name.replace(/^[^\s]+\s/, "")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Prompt Text *</label>
                <textarea
                  placeholder="e.g. dramatic cinematic lighting, volumetric rays, film grain, anamorphic lens"
                  value={newPrompt.prompt}
                  onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-black/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Description (optional)</label>
                <input
                  type="text"
                  placeholder="Short description of what this style does"
                  value={newPrompt.description}
                  onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                  className="w-full px-4 py-2 bg-black/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewPrompt({ name: "", prompt: "", categoryId: "", description: "" });
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewPrompt}
                  disabled={!newPrompt.name || !newPrompt.prompt || !newPrompt.categoryId || isSaving}
                  className="px-4 py-2 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Prompt"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-lime-400 animate-spin" />
              </div>
            </div>
          ) : activeTab === "popular" ? (
            /* Popular Templates */
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {popularTemplates.map((template) => (
                  <PromptCard
                    key={template.id}
                    template={template}
                    onSelect={handleSelectPrompt}
                    showCategory
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Categories Sidebar */}
              <div className="w-64 border-r border-zinc-800 overflow-y-auto p-3">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all mb-1",
                    selectedCategory === null
                      ? "bg-lime-500/10 text-lime-400"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  )}
                >
                  <span className="text-lg">📚</span>
                  <span className="font-medium">All Prompts</span>
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-all mb-1",
                      selectedCategory === category.id
                        ? "bg-lime-500/10 text-lime-400"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium truncate">
                        {category.name.replace(/^[^\s]+\s/, "")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                ))}
              </div>

              {/* Templates Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 font-medium">
                      No prompts found
                    </p>
                    <p className="text-sm text-zinc-600 mt-1">
                      Try a different search or category
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTemplates.map((template) => (
                      <PromptCard
                        key={template.id}
                        template={template}
                        onSelect={handleSelectPrompt}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PromptCard({
  template,
  onSelect,
  showCategory = false,
}: {
  template: PromptTemplate;
  onSelect: (template: PromptTemplate) => void;
  showCategory?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="group p-4 bg-black/50 hover:bg-zinc-900 border border-zinc-800 hover:border-lime-500/30 rounded-xl text-left transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-white group-hover:text-lime-400 transition-colors">
          {template.name}
        </h3>
        {template.use_count > 0 && (
          <span className="text-xs text-zinc-500 bg-zinc-700/50 px-2 py-1 rounded-full">
            {template.use_count} uses
          </span>
        )}
      </div>
      {showCategory && template.prompt_categories && (
        <div className="flex items-center gap-1 text-xs text-zinc-500 mb-2">
          <span>{template.prompt_categories.icon}</span>
          <span>{template.prompt_categories.name.replace(/^[^\s]+\s/, "")}</span>
        </div>
      )}
      <p className="text-sm text-zinc-400 line-clamp-2">{template.prompt}</p>
      {template.description && (
        <p className="text-xs text-zinc-500 mt-2">{template.description}</p>
      )}
    </button>
  );
}

