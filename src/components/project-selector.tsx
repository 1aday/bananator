"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  getProjects,
  createProject,
  deleteProject,
  type Project,
} from "@/lib/supabase";
import {
  FolderPlus,
  FolderOpen,
  Loader2,
  Trash2,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";

type ProjectSelectorProps = {
  onSelectProject: (project: Project) => void;
  currentProjectId?: string | null;
  onClose?: () => void;
};

export function ProjectSelector({
  onSelectProject,
  currentProjectId,
  onClose,
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setError("Project name is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const project = await createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      });
      setProjects((prev) => [project, ...prev]);
      setNewProjectName("");
      setNewProjectDescription("");
      setShowCreateForm(false);
      onSelectProject(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project and all its images?")) return;

    try {
      setDeletingId(id);
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center p-4">
      {/* Close button when switching projects */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🍌</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {onClose ? "Switch Project" : "Welcome to Banana"}
          </h1>
          <p className="text-zinc-400">
            {onClose 
              ? "Select a different project or create a new one"
              : "Select a project to continue, or create a new one"
            }
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Create Project Button / Form */}
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full mb-6 p-4 border-2 border-dashed border-zinc-700 hover:border-lime-500/50 rounded-xl flex items-center justify-center gap-3 text-zinc-400 hover:text-lime-400 transition-colors group"
          >
            <FolderPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Create New Project</span>
          </button>
        ) : (
          <form
            onSubmit={handleCreateProject}
            className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Description{" "}
                  <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="What's this project about?"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewProjectName("");
                    setNewProjectDescription("");
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim()}
                  className="flex-1 px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-black rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Projects List */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Recent Projects
          </h2>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {/* Elegant spinner */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-lime-400/10 blur-md animate-pulse" />
                <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-lime-400 border-r-lime-400/40 animate-spin" />
              </div>
              <p className="text-xs text-zinc-500">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No projects yet. Create your first one above!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectProject(project);
                    }
                  }}
                  className={cn(
                    "w-full p-4 bg-zinc-900 hover:bg-zinc-800 border rounded-xl text-left transition-all group cursor-pointer",
                    currentProjectId === project.id
                      ? "border-lime-400/50 ring-2 ring-lime-400/20"
                      : "border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-lime-400 flex-shrink-0" />
                        <h3 className="font-semibold text-white truncate">
                          {project.name}
                        </h3>
                      </div>
                      {project.description && (
                        <p className="text-sm text-zinc-500 mt-1 truncate">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-600">
                        <Clock className="w-3 h-3" />
                        <span>Updated {formatDate(project.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        disabled={deletingId === project.id}
                        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete project"
                      >
                        {deletingId === project.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-lime-400 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
