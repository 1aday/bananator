"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronRight,
  Home,
  Palette,
  Layers,
  Box,
  Sofa,
  Lightbulb,
  Frame,
  DoorOpen,
  Grid3X3,
  Paintbrush,
  Blinds,
  Trash2,
  Loader2,
  AlertCircle,
  Upload,
  Plus,
  FolderOpen,
  DoorClosed,
  Save,
  Building2,
  Wand2,
  Image as ImageLucide,
  Pencil,
} from "lucide-react";
import { ChangeEvent, DragEvent } from "react";
import { Project, Room, RoomDesign } from "@/lib/database.types";
import { Comparison } from "@/components/ui/comparison";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnnotateButton } from "@/components/image-annotator";

// Model types for image generation
type ModelType = "nano-banana-pro" | "seedream-edit" | "google-nano-banana";

interface ModelOption {
  value: ModelType;
  label: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: "nano-banana-pro", label: "Nano Banana Pro", description: "FAL • Fast editing" },
  { value: "google-nano-banana", label: "Google Nano Banana", description: "Replicate • Versatile" },
  { value: "seedream-edit", label: "Seedream 4.5 Edit", description: "FAL • High quality" },
];

// JSON structure types
interface DesignItem {
  id: string;
  label: string;
  materials: string[];
  colors: string[];
}

interface DesignCategory {
  materials_overall: string[];
  items: DesignItem[];
}

interface DesignMeta {
  title: string;
  style_tags: string[];
  summary: string;
}

interface DesignJSON {
  meta: DesignMeta;
  shell: {
    ceiling: DesignCategory;
    walls: DesignCategory;
    floor: DesignCategory;
    windows_and_trims: DesignCategory;
    doors_and_trims: DesignCategory;
    built_ins: DesignCategory;
  };
  interior: {
    layout_and_zoning: DesignCategory;
    furniture: DesignCategory;
    lighting: DesignCategory;
    textiles: DesignCategory;
    decor_and_art: DesignCategory;
  };
}

// Category icons mapping
const categoryIcons: Record<string, React.ReactNode> = {
  ceiling: <Layers className="w-3.5 h-3.5" />,
  walls: <Grid3X3 className="w-3.5 h-3.5" />,
  floor: <Box className="w-3.5 h-3.5" />,
  windows_and_trims: <Blinds className="w-3.5 h-3.5" />,
  doors_and_trims: <DoorOpen className="w-3.5 h-3.5" />,
  built_ins: <Frame className="w-3.5 h-3.5" />,
  layout_and_zoning: <Grid3X3 className="w-3.5 h-3.5" />,
  furniture: <Sofa className="w-3.5 h-3.5" />,
  lighting: <Lightbulb className="w-3.5 h-3.5" />,
  textiles: <Paintbrush className="w-3.5 h-3.5" />,
  decor_and_art: <Frame className="w-3.5 h-3.5" />,
};

// Format category name for display
function formatCategoryName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Editable label component for inline text editing
function EditableLabel({
  value,
  onSave,
  className = "",
  inputClassName = "",
  editable = true,
}: {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
  inputClassName?: string;
  editable?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing && editable) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          "bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-white outline-none focus:ring-1 focus:ring-lime-500/50",
          inputClassName
        )}
        autoFocus
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={cn(
        className,
        editable && "cursor-pointer hover:text-lime-400 transition-colors"
      )}
      onClick={(e) => {
        if (editable) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
      title={editable ? "Click to edit" : undefined}
    >
      {value}
    </span>
  );
}

// Empty design JSON template
const emptyDesignJSON: DesignJSON = {
  meta: { title: "", style_tags: [], summary: "" },
  shell: {
    ceiling: { materials_overall: [], items: [] },
    walls: { materials_overall: [], items: [] },
    floor: { materials_overall: [], items: [] },
    windows_and_trims: { materials_overall: [], items: [] },
    doors_and_trims: { materials_overall: [], items: [] },
    built_ins: { materials_overall: [], items: [] },
  },
  interior: {
    layout_and_zoning: { materials_overall: [], items: [] },
    furniture: { materials_overall: [], items: [] },
    lighting: { materials_overall: [], items: [] },
    textiles: { materials_overall: [], items: [] },
    decor_and_art: { materials_overall: [], items: [] },
  },
};

// Tag component for displaying materials/colors
function TagBadge({
  label,
  variant = "default",
  onRemove,
  onEdit,
  editable = false,
}: {
  label: string;
  variant?: "default" | "material" | "color" | "style";
  onRemove?: () => void;
  onEdit?: (newValue: string) => void;
  editable?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);

  const variantStyles = {
    default: "bg-zinc-800 text-zinc-300 border-zinc-700",
    material: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    color: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    style: "bg-lime-500/10 text-lime-400 border-lime-500/20",
  };

  const handleSave = () => {
    if (editValue.trim() && editValue !== label && onEdit) {
      onEdit(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(label);
      setIsEditing(false);
    }
  };

  if (isEditing && editable) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          "px-2 py-0.5 rounded-md text-xs border bg-zinc-900 text-white outline-none focus:ring-1 focus:ring-lime-500/50 w-24",
          variantStyles[variant]
        )}
        autoFocus
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border transition-colors group",
        variantStyles[variant],
        editable && "cursor-pointer hover:brightness-110",
        onRemove && "pr-1"
      )}
      onClick={() => editable && setIsEditing(true)}
      title={editable ? "Click to edit" : undefined}
    >
      {label}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 p-0.5 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// Add tag input component
function AddTagInput({
  variant = "default",
  placeholder = "Add...",
  onAdd,
}: {
  variant?: "default" | "material" | "color" | "style";
  placeholder?: string;
  onAdd: (value: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [value, setValue] = useState("");

  const variantStyles = {
    default: "border-zinc-700 focus:border-zinc-500",
    material: "border-amber-500/30 focus:border-amber-500/50",
    color: "border-violet-500/30 focus:border-violet-500/50",
    style: "border-lime-500/30 focus:border-lime-500/50",
  };

  const buttonStyles = {
    default: "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400",
    material: "border-amber-500/20 text-amber-500/50 hover:border-amber-500/40 hover:text-amber-400",
    color: "border-violet-500/20 text-violet-500/50 hover:border-violet-500/40 hover:text-violet-400",
    style: "border-lime-500/20 text-lime-500/50 hover:border-lime-500/40 hover:text-lime-400",
  };

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    } else if (e.key === "Escape") {
      setValue("");
      setIsAdding(false);
    }
  };

  if (isAdding) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setIsAdding(false);
          else handleAdd();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "px-2 py-0.5 rounded-md text-xs border bg-zinc-900 text-white outline-none focus:ring-1 focus:ring-lime-500/50 w-24",
          variantStyles[variant]
        )}
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={() => setIsAdding(true)}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-dashed transition-colors",
        buttonStyles[variant]
      )}
    >
      <Plus className="w-3 h-3" />
    </button>
  );
}

// Category section component
function CategorySection({
  name,
  category,
  isExpanded,
  onToggle,
  onUpdateMaterialsOverall,
  onAddMaterial,
  onRemoveMaterial,
  onUpdateItem,
  onDeleteItem,
  onRenameCategory,
}: {
  name: string;
  category: DesignCategory;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateMaterialsOverall?: (materials: string[]) => void;
  onAddMaterial?: (material: string) => void;
  onRemoveMaterial?: (material: string) => void;
  onUpdateItem?: (itemId: string, updates: Partial<DesignItem>) => void;
  onDeleteItem?: (itemId: string) => void;
  onRenameCategory?: (newName: string) => void;
}) {
  const hasContent =
    category.materials_overall.length > 0 || category.items.length > 0;
  const isEditable = !!onUpdateMaterialsOverall;

  return (
    <div className="border-b border-zinc-800/50 last:border-b-0">
      <div
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer",
          hasContent
            ? "hover:bg-zinc-800/50"
            : "hover:bg-zinc-800/30 opacity-50"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
        )}
        <span className="text-zinc-400">
          {categoryIcons[name] || <Box className="w-3.5 h-3.5" />}
        </span>
        {isEditable && onRenameCategory ? (
          <EditableLabel
            value={formatCategoryName(name)}
            onSave={(newValue) => {
              // Convert display name back to snake_case key
              const newKey = newValue.toLowerCase().replace(/\s+/g, "_");
              if (newKey !== name) {
                onRenameCategory(newKey);
              }
            }}
            className={cn(
              "text-sm flex-1",
              hasContent ? "text-zinc-200 font-medium" : "text-zinc-500"
            )}
            inputClassName="text-sm w-32"
            editable={true}
          />
        ) : (
          <span
            className={cn(
              "text-sm flex-1",
              hasContent ? "text-zinc-200 font-medium" : "text-zinc-500"
            )}
          >
            {formatCategoryName(name)}
          </span>
        )}
        {hasContent && (
          <span className="text-xs text-lime-400 bg-lime-400/10 px-1.5 py-0.5 rounded">
            {category.items.length || category.materials_overall.length}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-9 space-y-2">
          {/* Overall materials */}
          {(category.materials_overall.length > 0 || isEditable) && (
            <div className="flex flex-wrap gap-1 items-center">
              {category.materials_overall.map((mat, i) => (
                <TagBadge
                  key={i}
                  label={mat}
                  variant="material"
                  editable={isEditable}
                  onEdit={
                    isEditable && onUpdateMaterialsOverall
                      ? (newValue) => {
                          const newMaterials = [...category.materials_overall];
                          newMaterials[i] = newValue;
                          onUpdateMaterialsOverall(newMaterials);
                        }
                      : undefined
                  }
                  onRemove={
                    isEditable && (onRemoveMaterial || onUpdateMaterialsOverall)
                      ? () => {
                          // Use onRemoveMaterial to cascade removal to items
                          if (onRemoveMaterial) {
                            onRemoveMaterial(mat);
                          } else if (onUpdateMaterialsOverall) {
                            const newMaterials = category.materials_overall.filter(
                              (_, idx) => idx !== i
                            );
                            onUpdateMaterialsOverall(newMaterials);
                          }
                        }
                      : undefined
                  }
                />
              ))}
              {isEditable && (
                <AddTagInput
                  variant="material"
                  placeholder="Add material..."
                  onAdd={(value) => {
                    // Use onAddMaterial to propagate to items, or fallback to direct update
                    if (onAddMaterial) {
                      onAddMaterial(value);
                    } else if (onUpdateMaterialsOverall) {
                      onUpdateMaterialsOverall([...category.materials_overall, value]);
                    }
                  }}
                />
              )}
            </div>
          )}

          {/* Items */}
          {category.items.map((item) => (
            <div
              key={item.id}
              className="p-2 bg-zinc-800/30 rounded-lg border border-zinc-800 group"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                {isEditable && onUpdateItem ? (
                  <EditableLabel
                    value={item.label}
                    onSave={(newValue) => onUpdateItem(item.id, { label: newValue })}
                    className="text-sm text-white font-medium"
                    inputClassName="text-sm w-40"
                    editable={true}
                  />
                ) : (
                  <p className="text-sm text-white font-medium">
                    {item.label}
                  </p>
                )}
                {isEditable && onDeleteItem && (
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* Materials */}
              <div className="flex flex-wrap gap-1 items-center mb-1">
                {item.materials.map((mat, i) => (
                  <TagBadge
                    key={`mat-${i}`}
                    label={mat}
                    variant="material"
                    editable={isEditable}
                    onEdit={
                      isEditable && onUpdateItem
                        ? (newValue) => {
                            const newMaterials = [...item.materials];
                            newMaterials[i] = newValue;
                            onUpdateItem(item.id, { materials: newMaterials });
                          }
                        : undefined
                    }
                    onRemove={
                      isEditable && onUpdateItem
                        ? () => {
                            const newMaterials = item.materials.filter(
                              (_, idx) => idx !== i
                            );
                            onUpdateItem(item.id, { materials: newMaterials });
                          }
                        : undefined
                    }
                  />
                ))}
                {isEditable && onUpdateItem && (
                  <AddTagInput
                    variant="material"
                    placeholder="Material..."
                    onAdd={(value) => {
                      onUpdateItem(item.id, {
                        materials: [...item.materials, value],
                      });
                    }}
                  />
                )}
              </div>
              
              {/* Colors */}
              <div className="flex flex-wrap gap-1 items-center">
                {item.colors.map((color, i) => (
                  <TagBadge
                    key={`col-${i}`}
                    label={color}
                    variant="color"
                    editable={isEditable}
                    onEdit={
                      isEditable && onUpdateItem
                        ? (newValue) => {
                            const newColors = [...item.colors];
                            newColors[i] = newValue;
                            onUpdateItem(item.id, { colors: newColors });
                          }
                        : undefined
                    }
                    onRemove={
                      isEditable && onUpdateItem
                        ? () => {
                            const newColors = item.colors.filter(
                              (_, idx) => idx !== i
                            );
                            onUpdateItem(item.id, { colors: newColors });
                          }
                        : undefined
                    }
                  />
                ))}
                {isEditable && onUpdateItem && (
                  <AddTagInput
                    variant="color"
                    placeholder="Color..."
                    onAdd={(value) => {
                      onUpdateItem(item.id, {
                        colors: [...item.colors, value],
                      });
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Count total items in design
function countDesignItems(design: DesignJSON): number {
  let count = 0;
  
  // Count shell items
  Object.values(design.shell).forEach((category) => {
    count += category.items.length;
    count += category.materials_overall.length > 0 ? 1 : 0;
  });
  
  // Count interior items
  Object.values(design.interior).forEach((category) => {
    count += category.items.length;
    count += category.materials_overall.length > 0 ? 1 : 0;
  });
  
  return count;
}

function DesignerPageContent() {
  // URL state management
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Project & Room state
  const [projects, setProjects] = useState<Project[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<(Room & { latest_design?: RoomDesign | null }) | null>(null);
  
  // Update URL when project/room selection changes
  const updateURL = useCallback((projectId: string | null, roomId: string | null) => {
    const params = new URLSearchParams();
    if (projectId) params.set("project", projectId);
    if (roomId) params.set("room", roomId);
    const newUrl = params.toString() ? `?${params.toString()}` : "/designer";
    router.replace(newUrl, { scroll: false });
  }, [router]);
  
  // Wrapper to select project and update URL
  const selectProject = useCallback((project: Project | null) => {
    setSelectedProject(project);
    setSelectedRoom(null);
    updateURL(project?.id || null, null);
  }, [updateURL]);
  
  // Wrapper to select room and update URL
  const selectRoom = useCallback((room: (Room & { latest_design?: RoomDesign | null }) | null) => {
    setSelectedRoom(room);
    if (selectedProject) {
      updateURL(selectedProject.id, room?.id || null);
    }
  }, [selectedProject, updateURL]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showNewRoomInput, setShowNewRoomInput] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  // Design JSON state
  const [designJSON, setDesignJSON] = useState<DesignJSON>(emptyDesignJSON);

  // Prompt state
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [originalUploads, setOriginalUploads] = useState<string[]>([]); // Track original uploads for iteration
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0); // Which image to show in comparison

  // UI state
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Image rendering state
  const [selectedModel, setSelectedModel] = useState<ModelType>("nano-banana-pro");
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [beforeImage, setBeforeImage] = useState<string | null>(null); // Track the "before" image for comparison
  const [isRenderingImage, setIsRenderingImage] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Fetch projects on mount and restore from URL params
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
          
          // Check URL params first for project selection
          const urlProjectId = searchParams.get("project");
          if (urlProjectId) {
            const urlProject = data.find((p: Project) => p.id === urlProjectId);
            if (urlProject) {
              setSelectedProject(urlProject);
              return; // Don't check localStorage if URL has project
            }
          }
          
          // Fallback: Check for pre-selected project from home page (localStorage)
          const preSelectedId = localStorage.getItem("banana_designer_project_id");
          if (preSelectedId) {
            const preSelectedProject = data.find((p: Project) => p.id === preSelectedId);
            if (preSelectedProject) {
              setSelectedProject(preSelectedProject);
              // Update URL to reflect this selection
              updateURL(preSelectedId, null);
            }
            // Clear the stored ID after using it
            localStorage.removeItem("banana_designer_project_id");
          }
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    fetchProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Fetch rooms when project changes and restore room from URL
  useEffect(() => {
    if (!selectedProject) {
      setRooms([]);
      setSelectedRoom(null);
      return;
    }

    const fetchRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const response = await fetch(`/api/rooms?project_id=${selectedProject.id}`);
        if (response.ok) {
          const data = await response.json();
          setRooms(data);
          
          // Check URL params for room selection
          const urlRoomId = searchParams.get("room");
          if (urlRoomId) {
            const urlRoom = data.find((r: Room) => r.id === urlRoomId);
            if (urlRoom) {
              setSelectedRoom(urlRoom);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching rooms:", error);
      } finally {
        setIsLoadingRooms(false);
      }
    };
    fetchRooms();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]); // Only re-run when project ID changes

  // Load design when room changes
  useEffect(() => {
    if (!selectedRoom) {
      setDesignJSON(emptyDesignJSON);
      setUploadedImages([]);
      setSelectedImageIndex(0);
      setRenderedImage(null); setBeforeImage(null);
      return;
    }

    const loadRoomDesign = async () => {
      try {
        const response = await fetch(`/api/rooms/${selectedRoom.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.latest_design?.design_json) {
            const design = data.latest_design.design_json as DesignJSON;
            setDesignJSON(design);
          } else {
            setDesignJSON(emptyDesignJSON);
          }
          
          // Load saved images
          if (data.latest_design?.before_image_url) {
            setUploadedImages([data.latest_design.before_image_url]);
            setSelectedImageIndex(0);
          } else {
            setUploadedImages([]);
            setSelectedImageIndex(0);
          }
          if (data.latest_design?.rendered_image_url) {
            setRenderedImage(data.latest_design.rendered_image_url);
          } else {
            setRenderedImage(null); setBeforeImage(null);
          }
          
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error("Error loading room design:", error);
      }
    };
    loadRoomDesign();
  }, [selectedRoom?.id]);

  // Track unsaved changes
  useEffect(() => {
    if (selectedRoom) {
      setHasUnsavedChanges(true);
    }
  }, [designJSON]);

  // Create new room
  const createRoom = useCallback(async () => {
    if (!selectedProject || !newRoomName.trim()) return;

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProject.id,
          name: newRoomName.trim(),
        }),
      });

      if (response.ok) {
        const newRoom = await response.json();
        setRooms((prev) => [newRoom, ...prev]);
        selectRoom(newRoom);
        setNewRoomName("");
        setShowNewRoomInput(false);
      }
    } catch (error) {
      console.error("Error creating room:", error);
    }
  }, [selectedProject, newRoomName, selectRoom]);

  // Delete room (can delete roomToDelete or selectedRoom)
  const deleteRoom = useCallback(async () => {
    const targetRoom = roomToDelete || selectedRoom;
    if (!targetRoom) return;

    try {
      const response = await fetch(`/api/rooms/${targetRoom.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== targetRoom.id));
        // If we deleted the currently selected room, clear the selection
        if (selectedRoom?.id === targetRoom.id) {
          selectRoom(null);
          setDesignJSON(emptyDesignJSON);
          setUploadedImages([]);
          setSelectedImageIndex(0);
          setRenderedImage(null); setBeforeImage(null);
        }
        setRoomToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting room:", error);
    }
  }, [roomToDelete, selectedRoom]);

  // Save design to current room
  const saveDesign = useCallback(async () => {
    if (!selectedRoom) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}/designs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design_json: designJSON,
          before_image_url: uploadedImages[0] || null,
          rendered_image_url: renderedImage || null,
        }),
      });

      if (response.ok) {
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Error saving design:", error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedRoom, designJSON, uploadedImages, renderedImage]);

  // Convert design JSON to an image generation prompt
  const designToPrompt = useCallback((design: DesignJSON): string => {
    const parts: string[] = [];
    
    // Add title and style
    if (design.meta.title) {
      parts.push(design.meta.title);
    }
    if (design.meta.style_tags.length > 0) {
      parts.push(design.meta.style_tags.join(", ") + " style");
    }
    if (design.meta.summary) {
      parts.push(design.meta.summary);
    }

    // Collect all materials and colors
    const allMaterials: string[] = [];
    const allColors: string[] = [];

    // From shell
    Object.values(design.shell).forEach((cat) => {
      allMaterials.push(...cat.materials_overall);
      cat.items.forEach((item) => {
        allMaterials.push(...item.materials);
        allColors.push(...item.colors);
      });
    });

    // From interior
    Object.values(design.interior).forEach((cat) => {
      allMaterials.push(...cat.materials_overall);
      cat.items.forEach((item) => {
        allMaterials.push(...item.materials);
        allColors.push(...item.colors);
      });
    });

    // Dedupe and add
    const uniqueMaterials = [...new Set(allMaterials)].filter(Boolean);
    const uniqueColors = [...new Set(allColors)].filter(Boolean);

    if (uniqueMaterials.length > 0) {
      parts.push(`Materials: ${uniqueMaterials.slice(0, 8).join(", ")}`);
    }
    if (uniqueColors.length > 0) {
      parts.push(`Colors: ${uniqueColors.slice(0, 6).join(", ")}`);
    }

    // Add quality terms
    parts.push("professional interior design, high quality, photorealistic, 8k");

    return parts.join(". ");
  }, []);

  // Render the design as an image (with specific design to avoid stale state)
  const renderDesignImageWithDesign = useCallback(async (design: DesignJSON) => {
    if (uploadedImages.length === 0) {
      setRenderError("Please upload a reference image first");
      return;
    }

    // Capture the "before" image for comparison BEFORE rendering
    const currentBeforeImage = uploadedImages[selectedImageIndex] || uploadedImages[0];
    setBeforeImage(currentBeforeImage);
    
    setIsRenderingImage(true);
    setRenderError(null);

    try {
      const imagePrompt = designToPrompt(design);
      
      // Use appropriate aspect ratio based on model
      // FAL models use "auto", Replicate uses "match_input_image"
      const aspectRatio = selectedModel === "google-nano-banana" ? "match_input_image" : "auto";
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          imageInputs: uploadedImages, // Send ALL uploaded images as context
          model: selectedModel,
          aspectRatio,
          outputFormat: "png",
          resolution: "2K",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to render image");
      }

      if (data.imageUrl) {
        setRenderedImage(data.imageUrl);
        
        // Auto-set rendered image as input for next iteration (but beforeImage stays for comparison)
        setUploadedImages([data.imageUrl]);
        setSelectedImageIndex(0);
        
        // Auto-save the rendered image and design JSON to the room
        if (selectedRoom) {
          try {
            await fetch(`/api/rooms/${selectedRoom.id}/designs`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                design_json: design,
                rendered_image_url: data.imageUrl,
                before_image_url: uploadedImages[0] || null,
              }),
            });
            setHasUnsavedChanges(false);
          } catch (saveError) {
            console.error("Error auto-saving rendered image:", saveError);
          }
        }
      }
    } catch (error) {
      console.error("Render error:", error);
      setRenderError(error instanceof Error ? error.message : "Failed to render image");
    } finally {
      setIsRenderingImage(false);
    }
  }, [uploadedImages, selectedModel, designToPrompt, selectedRoom]);

  // Render using current designJSON state
  const renderDesignImage = useCallback(async () => {
    await renderDesignImageWithDesign(designJSON);
  }, [designJSON, renderDesignImageWithDesign]);

  // Update style tags in meta
  const updateStyleTags = useCallback((newTags: string[]) => {
    setDesignJSON((prev) => ({
      ...prev,
      meta: { ...prev.meta, style_tags: newTags },
    }));
  }, []);

  // Update materials_overall for a category
  const updateMaterialsOverall = useCallback(
    (section: "shell" | "interior", categoryName: string, materials: string[]) => {
      setDesignJSON((prev) => {
        const sectionData = prev[section] as Record<string, DesignCategory>;
        return {
          ...prev,
          [section]: {
            ...sectionData,
            [categoryName]: {
              ...sectionData[categoryName],
              materials_overall: materials,
            },
          },
        };
      });
    },
    []
  );

  // Add a new material to materials_overall AND to all items in that category
  const addMaterialToCategory = useCallback(
    (section: "shell" | "interior", categoryName: string, newMaterial: string) => {
      setDesignJSON((prev) => {
        const sectionData = prev[section] as Record<string, DesignCategory>;
        const category = sectionData[categoryName];
        // Add to materials_overall
        const newMaterialsOverall = [...category.materials_overall, newMaterial];
        // Also add to all items' materials (if not already present)
        const newItems = category.items.map((item) => ({
          ...item,
          materials: item.materials.includes(newMaterial)
            ? item.materials
            : [...item.materials, newMaterial],
        }));
        return {
          ...prev,
          [section]: {
            ...sectionData,
            [categoryName]: {
              ...category,
              materials_overall: newMaterialsOverall,
              items: newItems,
            },
          },
        };
      });
    },
    []
  );

  // Remove a material from materials_overall AND from all items in that category
  const removeMaterialFromCategory = useCallback(
    (section: "shell" | "interior", categoryName: string, materialToRemove: string) => {
      setDesignJSON((prev) => {
        const sectionData = prev[section] as Record<string, DesignCategory>;
        const category = sectionData[categoryName];
        // Remove from materials_overall
        const newMaterialsOverall = category.materials_overall.filter(
          (mat) => mat !== materialToRemove
        );
        // Also remove from all items' materials
        const newItems = category.items.map((item) => ({
          ...item,
          materials: item.materials.filter((mat) => mat !== materialToRemove),
        }));
        return {
          ...prev,
          [section]: {
            ...sectionData,
            [categoryName]: {
              ...category,
              materials_overall: newMaterialsOverall,
              items: newItems,
            },
          },
        };
      });
    },
    []
  );

  // Update an item's properties
  const updateItem = useCallback(
    (section: "shell" | "interior", categoryName: string, itemId: string, updates: Partial<DesignItem>) => {
      setDesignJSON((prev) => {
        const sectionData = prev[section] as Record<string, DesignCategory>;
        const category = sectionData[categoryName];
        const newItems = category.items.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item
        );
        return {
          ...prev,
          [section]: {
            ...sectionData,
            [categoryName]: {
              ...category,
              items: newItems,
            },
          },
        };
      });
    },
    []
  );

  // Delete an item
  const deleteItem = useCallback(
    (section: "shell" | "interior", categoryName: string, itemId: string) => {
      setDesignJSON((prev) => {
        const sectionData = prev[section] as Record<string, DesignCategory>;
        const category = sectionData[categoryName];
        const newItems = category.items.filter((item) => item.id !== itemId);
        return {
          ...prev,
          [section]: {
            ...sectionData,
            [categoryName]: {
              ...category,
              items: newItems,
            },
          },
        };
      });
    },
    []
  );

  // Rename a category (change its key)
  const renameCategory = useCallback(
    (section: "shell" | "interior", oldName: string, newName: string) => {
      if (oldName === newName) return;
      
      setDesignJSON((prev) => {
        const sectionData = prev[section] as Record<string, DesignCategory>;
        const category = sectionData[oldName];
        
        // Create new section data without the old key, with the new key
        const newSectionData: Record<string, DesignCategory> = {};
        Object.entries(sectionData).forEach(([key, value]) => {
          if (key === oldName) {
            newSectionData[newName] = value;
          } else {
            newSectionData[key] = value;
          }
        });
        
        return {
          ...prev,
          [section]: newSectionData,
        };
      });
    },
    []
  );

  // Compress image to reduce payload size for Vercel
  const compressImage = useCallback((file: File, maxDimension: number = 1024, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to JPEG for better compression
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(img.src);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load image"));
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Image handling
  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        // Process all files and collect results
        const fileArray = Array.from(files);
        const compressedImages: string[] = [];
        
        for (const file of fileArray) {
          if (!file.type.startsWith("image/")) continue;
          if (file.size > 20 * 1024 * 1024) continue;
          
          try {
            const compressedDataUrl = await compressImage(file, 768, 0.7);
            compressedImages.push(compressedDataUrl);
          } catch (error) {
            console.error("Error compressing image:", error);
          }
        }
        
        // Add all images at once to avoid race conditions
        if (compressedImages.length > 0) {
          setUploadedImages((prev) => [...prev, ...compressedImages]);
          setOriginalUploads((prev) => [...prev, ...compressedImages]); // Track original uploads
          setGenerationError(null);
        }
      }
      e.target.value = "";
    },
    [compressImage]
  );

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer?.files;
      if (files) {
        // Process all files and collect results
        const fileArray = Array.from(files);
        const compressedImages: string[] = [];
        
        for (const file of fileArray) {
          if (!file.type.startsWith("image/")) continue;
          if (file.size > 20 * 1024 * 1024) continue;
          
          try {
            const compressedDataUrl = await compressImage(file, 768, 0.7);
            compressedImages.push(compressedDataUrl);
          } catch (error) {
            console.error("Error compressing image:", error);
          }
        }
        
        // Add all images at once to avoid race conditions
        if (compressedImages.length > 0) {
          setUploadedImages((prev) => [...prev, ...compressedImages]);
          setOriginalUploads((prev) => [...prev, ...compressedImages]); // Track original uploads
          setGenerationError(null);
        }
      }
    },
    [compressImage]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Check if design has any content (moved before generateDesign to avoid reference error)
  const hasContent =
    designJSON.meta.title ||
    designJSON.meta.style_tags.length > 0 ||
    Object.values(designJSON.shell).some(
      (cat) => cat.materials_overall.length > 0 || cat.items.length > 0
    ) ||
    Object.values(designJSON.interior).some(
      (cat) => cat.materials_overall.length > 0 || cat.items.length > 0
    );

  // Generate design from prompt (or regenerate existing)
  const generateDesign = useCallback(async () => {
    // Build the prompt - use new prompt, or create regeneration prompt from existing design
    let effectivePrompt = prompt.trim();
    
    if (!effectivePrompt && hasContent) {
      // Regenerate based on existing design
      const styleTags = designJSON.meta.style_tags.join(", ");
      const title = designJSON.meta.title || "";
      effectivePrompt = `Regenerate and refine: ${title}. Style: ${styleTags}. Keep the same overall concept but enhance the details.`;
    }
    
    if (!effectivePrompt) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch("/api/designer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: effectivePrompt,
          // Send all images for better context (images are compressed)
          images: uploadedImages.length > 0 ? uploadedImages : undefined,
          roomName: selectedRoom?.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate design");
      }

      if (data.design) {
        setDesignJSON(data.design);
        setPrompt(""); // Clear prompt after success
        setRenderedImage(null); setBeforeImage(null); // Clear previous render
        
        // Auto-save if room is selected
        if (selectedRoom) {
          try {
            await fetch(`/api/rooms/${selectedRoom.id}/designs`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                design_json: data.design,
              }),
            });
            setHasUnsavedChanges(false);
          } catch (saveError) {
            console.error("Error auto-saving design:", saveError);
          }
        }

        // Auto-start image rendering if we have a reference image
        if (uploadedImages.length > 0) {
          // Start rendering with the new design
          renderDesignImageWithDesign(data.design);
        }
      }
    } catch (error) {
      console.error("Generation error:", error);
      setGenerationError(
        error instanceof Error ? error.message : "Failed to generate design"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, uploadedImages, hasContent, designJSON, selectedRoom, renderDesignImageWithDesign]);

  // Clear design
  const clearDesign = useCallback(() => {
    setDesignJSON(emptyDesignJSON);
    setGenerationError(null);
    setUploadedImages([]);
    setSelectedImageIndex(0);
  }, []);

  const totalItems = countDesignItems(designJSON);

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col lg:flex-row overflow-hidden">
      {/* ============================================ */}
      {/* MAIN CONTENT AREA */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-3 sm:px-4 py-3 border-b border-white/5 bg-black/20">
          {/* Desktop: Single row | Mobile: Two rows */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
            {/* Left side - Logo, Title, Selectors */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
              {/* Logo and Title */}
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-xl sm:text-2xl">🍌</span>
                    <span className="font-bold text-lg sm:text-xl text-lime-400 hidden sm:inline">Banana</span>
                  </Link>
                  <div className="w-px h-5 sm:h-6 bg-zinc-800 hidden sm:block" />
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-violet-500/10 rounded-lg flex items-center justify-center">
                      <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" />
                    </div>
                    <span className="text-base sm:text-lg font-semibold text-white">Designer</span>
                  </div>
                </div>
                
                {/* Mobile & Tablet: Home link only (bottom sheet handles controls) */}
                <div className="flex lg:hidden items-center gap-2">
                  <Link
                    href="/"
                    className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Home"
                  >
                    <Home className="w-5 h-5" />
                  </Link>
                </div>
              </div>
              
              {/* Divider - Desktop only */}
              <div className="w-px h-6 bg-zinc-800 hidden lg:block" />
              
              {/* Project & Room Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Project Selector */}
                <div className={cn(
                  "relative flex-1 min-w-[140px] sm:flex-none",
                  !selectedProject && projects.length > 0 && "animate-pulse"
                )}>
                  {/* Glow ring when no selection */}
                  {!selectedProject && projects.length > 0 && (
                    <div className="absolute -inset-1 bg-violet-500/30 rounded-xl blur-md animate-pulse" />
                  )}
                  <select
                    value={selectedProject?.id || ""}
                    onChange={(e) => {
                      const project = projects.find((p) => p.id === e.target.value);
                      selectProject(project || null);
                    }}
                    disabled={isLoadingProjects}
                    className={cn(
                      "relative w-full sm:w-auto appearance-none rounded-lg px-3 py-2 sm:py-1.5 pr-8 text-sm text-white focus:outline-none cursor-pointer disabled:opacity-50",
                      !selectedProject && projects.length > 0
                        ? "bg-violet-500/20 border-2 border-violet-500 ring-2 ring-violet-500/30"
                        : "bg-zinc-800 border border-zinc-700 focus:ring-2 focus:ring-violet-500"
                    )}
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <FolderOpen className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
                    !selectedProject && projects.length > 0 ? "text-violet-400" : "text-zinc-500"
                  )} />
                </div>

                {/* Room Selector (only show when project selected) */}
                {selectedProject && (
                  <>
                    <ChevronRight className="w-4 h-4 text-zinc-600 hidden sm:block" />
                    <div className="flex items-center gap-1 flex-1 min-w-[140px] sm:flex-none">
                      <div className={cn(
                        "relative flex-1 sm:flex-none",
                        !selectedRoom && "animate-pulse"
                      )}>
                        {/* Glow ring when no selection */}
                        {!selectedRoom && (
                          <div className="absolute -inset-1 bg-lime-500/30 rounded-xl blur-md animate-pulse" />
                        )}
                        <select
                          value={selectedRoom?.id || ""}
                          onChange={(e) => {
                            if (e.target.value === "__new__") {
                              setShowNewRoomInput(true);
                            } else {
                              const room = rooms.find((r) => r.id === e.target.value);
                              selectRoom(room || null);
                            }
                          }}
                          disabled={isLoadingRooms}
                          className={cn(
                            "relative w-full sm:w-auto appearance-none rounded-lg px-3 py-2 sm:py-1.5 pr-8 text-sm text-white focus:outline-none cursor-pointer disabled:opacity-50",
                            !selectedRoom
                              ? "bg-lime-500/20 border-2 border-lime-500 ring-2 ring-lime-500/30"
                              : "bg-zinc-800 border border-zinc-700 focus:ring-2 focus:ring-violet-500"
                          )}
                        >
                          <option value="">Select Room</option>
                          {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                          <option value="__new__">+ New Room</option>
                        </select>
                        <DoorClosed className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
                          !selectedRoom ? "text-lime-400" : "text-zinc-500"
                        )} />
                      </div>
                      {selectedRoom && (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="p-2 sm:p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title={`Delete ${selectedRoom.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Save indicator - Desktop inline */}
                {selectedRoom && (
                  <button
                    onClick={saveDesign}
                    disabled={isSaving || !hasUnsavedChanges}
                    className={cn(
                      "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                      hasUnsavedChanges
                        ? "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                        : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {hasUnsavedChanges ? "Save" : "Saved"}
                  </button>
                )}
              </div>
            </div>
            
            {/* Right side - Action buttons (Desktop only) */}
            <div className="hidden lg:flex items-center gap-1">
              <Link
                href="/"
                className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="Home"
              >
                <Home className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* New Room Input Modal */}
        {showNewRoomInput && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewRoomInput(false)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-3">New Room</h3>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createRoom()}
                placeholder="Room name (e.g., Living Room)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 sm:py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3 text-base sm:text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowNewRoomInput(false);
                    setNewRoomName("");
                  }}
                  className="flex-1 px-3 py-2.5 sm:py-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createRoom}
                  disabled={!newRoomName.trim()}
                  className="flex-1 px-3 py-2.5 sm:py-1.5 text-sm bg-violet-500 hover:bg-violet-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Canvas Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto">
            {/* Show setup prompt if no project/room selected */}
            {!selectedProject ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                {/* Header */}
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-xl animate-pulse" />
                  <div className="relative w-16 h-16 bg-gradient-to-br from-violet-500/20 to-violet-600/10 rounded-2xl flex items-center justify-center border border-violet-500/20">
                    <Building2 className="w-8 h-8 text-violet-400" />
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-white mb-1">
                  Select a Project
                </h3>
                <p className="text-zinc-500 text-sm mb-6">
                  Choose a project to start designing rooms
                </p>
                
                {isLoadingProjects ? (
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-zinc-600 text-sm">No projects yet.</p>
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
                    >
                      <Home className="w-4 h-4" />
                      Go to Workspace
                    </Link>
                  </div>
                ) : (
                  <div className="w-full max-w-2xl">
                    {/* Project Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                      {projects.slice(0, 8).map((project) => (
                        <button
                          key={project.id}
                          onClick={() => selectProject(project)}
                          className="group flex flex-col items-center gap-2 p-3 sm:p-4 bg-zinc-900/50 hover:bg-violet-500/10 border border-zinc-800 hover:border-violet-500/50 rounded-xl transition-all hover:scale-[1.02]"
                        >
                          <div className="w-10 h-10 bg-zinc-800 group-hover:bg-violet-500/20 rounded-lg flex items-center justify-center transition-colors">
                            <FolderOpen className="w-5 h-5 text-zinc-500 group-hover:text-violet-400 transition-colors" />
                          </div>
                          <span className="text-sm text-zinc-300 group-hover:text-white font-medium truncate w-full text-center transition-colors">
                            {project.name}
                          </span>
                        </button>
                      ))}
                    </div>
                    
                    {/* Show more indicator */}
                    {projects.length > 8 && (
                      <p className="text-xs text-zinc-600 mt-4">
                        +{projects.length - 8} more in dropdown above
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : !selectedRoom ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                {/* Header */}
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-lime-500/20 rounded-2xl blur-xl animate-pulse" />
                  <div className="relative w-16 h-16 bg-gradient-to-br from-lime-500/20 to-lime-600/10 rounded-2xl flex items-center justify-center border border-lime-500/20">
                    <DoorClosed className="w-8 h-8 text-lime-400" />
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-white mb-1">
                  Select a Room
                </h3>
                <p className="text-zinc-500 text-sm mb-6">
                  in <span className="text-violet-400 font-medium">{selectedProject?.name}</span>
                </p>
                
                {isLoadingRooms ? (
                  <Loader2 className="w-6 h-6 text-lime-400 animate-spin" />
                ) : (
                  <div className="w-full max-w-2xl">
                    {rooms.length > 0 ? (
                      <>
                        {/* Room Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                          {rooms.map((room) => (
                            <div
                              key={room.id}
                              className="group relative"
                            >
                              <button
                                onClick={() => selectRoom(room)}
                                className="w-full flex flex-col items-center gap-2 p-3 sm:p-4 bg-zinc-900/50 hover:bg-lime-500/10 border border-zinc-800 hover:border-lime-500/50 rounded-xl transition-all hover:scale-[1.02]"
                              >
                                <div className="w-10 h-10 bg-zinc-800 group-hover:bg-lime-500/20 rounded-lg flex items-center justify-center transition-colors">
                                  <DoorOpen className="w-5 h-5 text-zinc-500 group-hover:text-lime-400 transition-colors" />
                                </div>
                                <span className="text-sm text-zinc-300 group-hover:text-white font-medium truncate w-full text-center transition-colors">
                                  {room.name}
                                </span>
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRoomToDelete(room);
                                  setShowDeleteConfirm(true);
                                }}
                                className="absolute top-1 right-1 p-1.5 rounded-lg bg-zinc-900/80 text-zinc-500 hover:text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                                title={`Delete ${room.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          
                          {/* Create New Room Card */}
                          <button
                            onClick={() => setShowNewRoomInput(true)}
                            className="group flex flex-col items-center gap-2 p-3 sm:p-4 bg-lime-500/5 hover:bg-lime-500/15 border-2 border-dashed border-lime-500/30 hover:border-lime-500/60 rounded-xl transition-all hover:scale-[1.02]"
                          >
                            <div className="w-10 h-10 bg-lime-500/10 group-hover:bg-lime-500/20 rounded-lg flex items-center justify-center transition-colors">
                              <Plus className="w-5 h-5 text-lime-500 group-hover:text-lime-400 transition-colors" />
                            </div>
                            <span className="text-sm text-lime-500 group-hover:text-lime-400 font-medium transition-colors">
                              New Room
                            </span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-xl text-zinc-500 text-sm">
                          <DoorClosed className="w-4 h-4" />
                          No rooms yet in this project
                        </div>
                        <button
                          onClick={() => setShowNewRoomInput(true)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-lime-500 hover:bg-lime-400 text-black font-medium rounded-xl transition-all hover:scale-105 hover:shadow-lg hover:shadow-lime-500/20"
                        >
                          <Plus className="w-4 h-4" />
                          Create First Room
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : !hasContent && uploadedImages.length === 0 && !isGenerating ? (
              /* Empty State - Room selected but no design and no image */
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
                {/* Upload Area */}
                <label
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={cn(
                    "w-full max-w-md aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all mb-6",
                    isDragging
                      ? "border-lime-500 bg-lime-500/10"
                      : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50"
                  )}
                >
                  <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-3">
                    <Upload className="w-8 h-8 text-zinc-500" />
                  </div>
                  <p className="text-zinc-300 font-medium mb-1">
                    Drop room photos here
                  </p>
                  <p className="text-zinc-500 text-sm">
                    or click to browse • Multiple images supported
                  </p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple={true}
                    onChange={handleFileSelect} 
                    className="hidden" 
                  />
                </label>

                <h3 className="text-xl font-semibold text-white mb-2">
                  Design: {selectedRoom.name}
                </h3>
                <p className="text-zinc-500 max-w-md text-sm mb-6">
                  Upload room photos and describe your design vision. The AI will
                  generate a structured design concept with materials, colors,
                  and styling suggestions.
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {[
                    "Modern minimalist",
                    "Cozy Scandinavian",
                    "Industrial loft",
                    "Bohemian style",
                    "Art deco",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setPrompt(suggestion)}
                      className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Design Preview */
              <div className="space-y-6">
                {/* Before/After Comparison - Large Display */}
                {uploadedImages.length > 0 && (
                  <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
                    {/* Image Display - Responsive height */}
                    <div className="relative w-full aspect-[4/3] sm:aspect-video lg:min-h-[500px] xl:min-h-[600px]">
                      {renderedImage ? (
                        <Comparison
                          firstImage={beforeImage || uploadedImages[selectedImageIndex] || uploadedImages[0]}
                          secondImage={renderedImage}
                          className="w-full h-full"
                          firstImageClassName="object-contain"
                          secondImageClassname="object-contain"
                        />
                      ) : (
                        <div className="relative w-full h-full">
                          <img
                            src={uploadedImages[selectedImageIndex] || uploadedImages[0]}
                            alt="Reference"
                            className="w-full h-full object-contain"
                          />
                          {isRenderingImage && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
                              {/* Animated rings */}
                              <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 animate-ping absolute inset-0" />
                                <div className="w-16 h-16 rounded-full border-4 border-t-violet-400 border-r-violet-400 border-b-transparent border-l-transparent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Wand2 className="w-6 h-6 text-violet-400" />
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-white font-medium mb-1">Rendering your design</p>
                                <p className="text-sm text-zinc-400">Applying materials & colors...</p>
                              </div>
                              {/* Progress dots */}
                              <div className="flex gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Controls Bar */}
                    <div className="px-3 sm:px-4 py-3 border-t border-zinc-800">
                      {/* Mobile: Stack layout */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Input Images Thumbnails - Always show */}
                          <div className="flex items-center gap-1.5">
                            {uploadedImages.map((img, i) => (
                              <div key={i} className="relative group">
                                <button
                                  onClick={() => setSelectedImageIndex(i)}
                                  className={cn(
                                    "w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                                    i === selectedImageIndex 
                                      ? "border-lime-500 ring-2 ring-lime-500/30" 
                                      : "border-zinc-700 opacity-70 hover:opacity-100 hover:border-zinc-500"
                                  )}
                                  title={`Reference ${i + 1}${i === selectedImageIndex ? " (comparing)" : " - click to compare"}`}
                                >
                                  <img src={img} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                                </button>
                                {/* Remove button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUploadedImages(prev => prev.filter((_, idx) => idx !== i));
                                    if (selectedImageIndex >= uploadedImages.length - 1) {
                                      setSelectedImageIndex(Math.max(0, uploadedImages.length - 2));
                                    }
                                  }}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-2.5 h-2.5 text-white" />
                                </button>
                              </div>
                            ))}
                            {/* Add more images button */}
                            <label className="w-10 h-10 border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-lg flex items-center justify-center cursor-pointer transition-colors">
                              <Plus className="w-4 h-4 text-zinc-500" />
                              <input
                                type="file"
                                accept="image/*"
                                multiple={true}
                                onChange={handleFileSelect}
                                className="hidden"
                              />
                            </label>
                            {uploadedImages.length > 1 && (
                              <span className="text-xs text-zinc-500 hidden sm:inline">
                                {uploadedImages.length} inputs
                              </span>
                            )}
                            {/* Select from history - original uploads */}
                            {originalUploads.length > 0 && originalUploads.some(img => !uploadedImages.includes(img)) && (
                              <>
                                <span className="text-zinc-600 mx-1">|</span>
                                <span className="text-[10px] text-zinc-500 mr-1">History:</span>
                                {originalUploads.filter(img => !uploadedImages.includes(img)).slice(0, 3).map((img, i) => (
                                  <button
                                    key={`orig-${i}`}
                                    onClick={() => setUploadedImages(prev => [...prev, img])}
                                    className="w-8 h-8 rounded-lg overflow-hidden border-2 border-zinc-700 hover:border-violet-500 transition-all hover:scale-105"
                                    title="Add original upload"
                                  >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-zinc-500">→</span>
                            <span className={cn(
                              isGenerating && !hasContent ? "text-amber-400" :
                              isRenderingImage ? "text-violet-400" : 
                              renderedImage ? "text-lime-400" : "text-zinc-500"
                            )}>
                              {isGenerating && !hasContent ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                  </span>
                                  <span className="hidden sm:inline">Generating design...</span>
                                  <span className="sm:hidden">Generating...</span>
                                </span>
                              ) : isRenderingImage ? (
                                <span className="flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Rendering...
                                </span>
                              ) : renderedImage ? "Output" : "Ready"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderError && (
                            <span className="text-xs text-red-400 mr-2 hidden sm:inline">{renderError}</span>
                          )}
                          <AnnotateButton
                            imageUrl={renderedImage || uploadedImages[selectedImageIndex] || uploadedImages[0]}
                            onAnnotated={(annotatedUrl) => {
                              // Replace the selected image with the annotated version
                              setUploadedImages(prev => {
                                const newImages = [...prev];
                                newImages[selectedImageIndex] = annotatedUrl;
                                return newImages;
                              });
                              if (renderedImage) setRenderedImage(null); setBeforeImage(null);
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 sm:py-1.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition-colors border border-violet-500/20 text-sm"
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="hidden sm:inline">Annotate</span>
                          </AnnotateButton>
                          <button
                            onClick={() => {
                              setRenderedImage(null); setBeforeImage(null);
                              setUploadedImages([]);
                              setSelectedImageIndex(0);
                            }}
                            className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 rounded-lg transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            onClick={renderDesignImage}
                            disabled={isRenderingImage || !hasContent}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 bg-violet-500 hover:bg-violet-600 active:bg-violet-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm rounded-lg transition-colors"
                          >
                            {isRenderingImage ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4" />
                            )}
                            {renderedImage ? "Re-render" : "Render"}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Prompt Box Under Image */}
                    <div className="px-3 sm:px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
                      <div className="flex gap-3">
                        {/* Left: Image Upload Thumbnail */}
                        <label className={cn(
                          "relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                          uploadedImages.length > 0 
                            ? "border-2 border-lime-500/40 hover:border-lime-500/60" 
                            : "bg-zinc-800 border-2 border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/80"
                        )}>
                          {uploadedImages.length > 0 ? (
                            <>
                              <img src={uploadedImages[selectedImageIndex] || uploadedImages[0]} alt="" className="w-full h-full object-cover" />
                              {/* Badge showing image count */}
                              {uploadedImages.length > 1 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-lime-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                                  {uploadedImages.length}
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <ImageLucide className="w-5 h-5 text-zinc-500" />
                              <span className="text-[10px] text-zinc-600">Add</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple={true}
                            onChange={handleFileSelect} 
                            className="hidden" 
                          />
                        </label>

                        {/* Center: Prompt + Model */}
                        <div className="flex-1 flex flex-col gap-2">
                          {/* Prompt textarea */}
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if ((prompt.trim() || hasContent) && !isGenerating && selectedRoom) {
                                  generateDesign();
                                }
                              }
                            }}
                            placeholder={selectedRoom ? "Describe your design vision..." : "Select a room first"}
                            disabled={!selectedRoom}
                            rows={2}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500/50 resize-none disabled:opacity-50"
                          />
                          
                          {/* Bottom row: Model selector + Quick suggestions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Compact Model Selector */}
                            <div className="relative">
                              <button
                                onClick={() => setShowModelSelector(!showModelSelector)}
                                className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs transition-colors"
                              >
                                <Wand2 className="w-3 h-3 text-violet-400" />
                                <span className="text-zinc-300 hidden sm:inline">{MODEL_OPTIONS.find(m => m.value === selectedModel)?.label}</span>
                                <span className="text-zinc-300 sm:hidden">{MODEL_OPTIONS.find(m => m.value === selectedModel)?.label.split(' ')[0]}</span>
                                <ChevronDown className={cn("w-3 h-3 text-zinc-500 transition-transform", showModelSelector && "rotate-180")} />
                              </button>
                              {showModelSelector && (
                                <div className="absolute bottom-full left-0 mb-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 overflow-hidden">
                                  {MODEL_OPTIONS.map((model) => (
                                    <button
                                      key={model.value}
                                      onClick={() => {
                                        setSelectedModel(model.value);
                                        setShowModelSelector(false);
                                      }}
                                      className={cn(
                                        "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-sm",
                                        selectedModel === model.value
                                          ? "bg-violet-500/20 text-violet-300"
                                          : "text-zinc-300 hover:bg-zinc-800"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        selectedModel === model.value ? "bg-violet-400" : "bg-zinc-600"
                                      )} />
                                      <div>
                                        <p className="font-medium">{model.label}</p>
                                        <p className="text-[10px] text-zinc-500">{model.description}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Quick style chips */}
                            {!prompt.trim() && (
                              <div className="flex gap-1 flex-wrap">
                                {["Modern", "Scandinavian", "Industrial", "Bohemian"].map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    onClick={() => setPrompt(suggestion + " style")}
                                    className="px-2 py-0.5 text-[11px] bg-zinc-800/60 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Generate Button */}
                        <button
                          onClick={generateDesign}
                          disabled={(!prompt.trim() && !hasContent) || isGenerating || !selectedRoom}
                          className={cn(
                            "flex-shrink-0 flex items-center justify-center gap-2 px-4 h-14 sm:h-16 rounded-xl transition-all text-sm font-medium",
                            (!prompt.trim() && !hasContent) || !selectedRoom 
                              ? "bg-zinc-800 text-zinc-600" 
                              : "bg-lime-400 hover:bg-lime-300 text-black"
                          )}
                        >
                          {isGenerating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Sparkles className="w-5 h-5" />
                          )}
                          <span className="hidden sm:inline">Generate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Meta Header - with skeleton loading */}
                {isGenerating && !hasContent ? (
                  /* Skeleton for Meta Header */
                  <div className="bg-gradient-to-br from-violet-500/5 to-lime-500/5 rounded-2xl p-6 border border-zinc-800 animate-pulse">
                    <div className="h-8 bg-zinc-800 rounded-lg w-3/4 mb-3" />
                    <div className="h-4 bg-zinc-800/60 rounded w-full mb-4" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-zinc-800 rounded-full w-20" />
                      <div className="h-6 bg-zinc-800 rounded-full w-24" />
                      <div className="h-6 bg-zinc-800 rounded-full w-16" />
                    </div>
                  </div>
                ) : (designJSON.meta.title || designJSON.meta.style_tags.length > 0) ? (
                  <div className="bg-gradient-to-br from-violet-500/10 to-lime-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-violet-500/20">
                    {designJSON.meta.title && (
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                        {designJSON.meta.title}
                      </h2>
                    )}
                    {designJSON.meta.summary && (
                      <p className="text-zinc-400 mb-4">
                        {designJSON.meta.summary}
                      </p>
                    )}
                    {/* Editable Style Tags */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {designJSON.meta.style_tags.map((tag, i) => (
                        <TagBadge
                          key={i}
                          label={tag}
                          variant="style"
                          editable
                          onEdit={(newValue) => {
                            const newTags = [...designJSON.meta.style_tags];
                            newTags[i] = newValue;
                            updateStyleTags(newTags);
                          }}
                          onRemove={() => {
                            const newTags = designJSON.meta.style_tags.filter((_, idx) => idx !== i);
                            updateStyleTags(newTags);
                          }}
                        />
                      ))}
                      <AddTagInput
                        variant="style"
                        placeholder="Add style..."
                        onAdd={(value) => {
                          updateStyleTags([...designJSON.meta.style_tags, value]);
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {/* All Items Grid - with skeleton loading */}
                {isGenerating && !hasContent ? (
                  /* Skeleton for Design Elements */
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-lg font-semibold text-white">All Design Elements</h3>
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 animate-pulse"
                          style={{ animationDelay: `${i * 100}ms` }}
                        >
                          <div className="flex items-start gap-2 mb-3">
                            <div className="w-4 h-4 bg-zinc-800 rounded mt-0.5" />
                            <div className="flex-1">
                              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-1.5" />
                              <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
                            </div>
                          </div>
                          <div className="flex gap-1.5 mb-2">
                            <div className="h-5 bg-amber-500/20 rounded-full w-16" />
                            <div className="h-5 bg-amber-500/20 rounded-full w-12" />
                          </div>
                          <div className="flex gap-1.5">
                            <div className="h-5 bg-violet-500/20 rounded-full w-14" />
                            <div className="h-5 bg-violet-500/20 rounded-full w-18" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : hasContent ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">All Design Elements</h3>
                      {uploadedImages.length > 0 && (
                        <button
                          onClick={renderDesignImage}
                          disabled={isRenderingImage}
                          className="flex items-center gap-2 px-3 py-2 sm:py-1.5 bg-violet-500/20 hover:bg-violet-500/30 active:bg-violet-500/40 disabled:bg-zinc-800 disabled:text-zinc-600 text-violet-300 text-sm rounded-lg border border-violet-500/30 transition-colors"
                        >
                          {isRenderingImage ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wand2 className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">Regenerate Image</span>
                          <span className="sm:hidden">Regenerate</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {/* Shell items */}
                      {Object.entries(designJSON.shell).flatMap(([category, data]) =>
                        data.items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2">
                                <span className="text-amber-400 mt-0.5">
                                  {categoryIcons[category] || <Box className="w-4 h-4" />}
                                </span>
                                <div>
                                  <EditableLabel
                                    value={item.label}
                                    onSave={(newValue) => updateItem("shell", category, item.id, { label: newValue })}
                                    className="text-sm font-medium text-white"
                                    inputClassName="text-sm w-36"
                                  />
                                  <EditableLabel
                                    value={formatCategoryName(category)}
                                    onSave={(newValue) => {
                                      const newKey = newValue.toLowerCase().replace(/\s+/g, "_");
                                      if (newKey !== category) {
                                        renameCategory("shell", category, newKey);
                                      }
                                    }}
                                    className="text-xs text-zinc-500"
                                    inputClassName="text-xs w-28"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => deleteItem("shell", category, item.id)}
                                className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {/* Materials */}
                            <div className="flex flex-wrap gap-1 items-center mb-1">
                              {item.materials.map((mat, i) => (
                                <TagBadge
                                  key={`mat-${i}`}
                                  label={mat}
                                  variant="material"
                                  editable
                                  onEdit={(newValue) => {
                                    const newMaterials = [...item.materials];
                                    newMaterials[i] = newValue;
                                    updateItem("shell", category, item.id, { materials: newMaterials });
                                  }}
                                  onRemove={() => {
                                    const newMaterials = item.materials.filter((_, idx) => idx !== i);
                                    updateItem("shell", category, item.id, { materials: newMaterials });
                                  }}
                                />
                              ))}
                              <AddTagInput
                                variant="material"
                                placeholder="+"
                                onAdd={(value) => {
                                  updateItem("shell", category, item.id, { materials: [...item.materials, value] });
                                }}
                              />
                            </div>
                            {/* Colors */}
                            <div className="flex flex-wrap gap-1 items-center">
                              {item.colors.map((color, i) => (
                                <TagBadge
                                  key={`col-${i}`}
                                  label={color}
                                  variant="color"
                                  editable
                                  onEdit={(newValue) => {
                                    const newColors = [...item.colors];
                                    newColors[i] = newValue;
                                    updateItem("shell", category, item.id, { colors: newColors });
                                  }}
                                  onRemove={() => {
                                    const newColors = item.colors.filter((_, idx) => idx !== i);
                                    updateItem("shell", category, item.id, { colors: newColors });
                                  }}
                                />
                              ))}
                              <AddTagInput
                                variant="color"
                                placeholder="+"
                                onAdd={(value) => {
                                  updateItem("shell", category, item.id, { colors: [...item.colors, value] });
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                      {/* Interior items */}
                      {Object.entries(designJSON.interior).flatMap(([category, data]) =>
                        data.items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2">
                                <span className="text-violet-400 mt-0.5">
                                  {categoryIcons[category] || <Sofa className="w-4 h-4" />}
                                </span>
                                <div>
                                  <EditableLabel
                                    value={item.label}
                                    onSave={(newValue) => updateItem("interior", category, item.id, { label: newValue })}
                                    className="text-sm font-medium text-white"
                                    inputClassName="text-sm w-36"
                                  />
                                  <EditableLabel
                                    value={formatCategoryName(category)}
                                    onSave={(newValue) => {
                                      const newKey = newValue.toLowerCase().replace(/\s+/g, "_");
                                      if (newKey !== category) {
                                        renameCategory("interior", category, newKey);
                                      }
                                    }}
                                    className="text-xs text-zinc-500"
                                    inputClassName="text-xs w-28"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => deleteItem("interior", category, item.id)}
                                className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {/* Materials */}
                            <div className="flex flex-wrap gap-1 items-center mb-1">
                              {item.materials.map((mat, i) => (
                                <TagBadge
                                  key={`mat-${i}`}
                                  label={mat}
                                  variant="material"
                                  editable
                                  onEdit={(newValue) => {
                                    const newMaterials = [...item.materials];
                                    newMaterials[i] = newValue;
                                    updateItem("interior", category, item.id, { materials: newMaterials });
                                  }}
                                  onRemove={() => {
                                    const newMaterials = item.materials.filter((_, idx) => idx !== i);
                                    updateItem("interior", category, item.id, { materials: newMaterials });
                                  }}
                                />
                              ))}
                              <AddTagInput
                                variant="material"
                                placeholder="+"
                                onAdd={(value) => {
                                  updateItem("interior", category, item.id, { materials: [...item.materials, value] });
                                }}
                              />
                            </div>
                            {/* Colors */}
                            <div className="flex flex-wrap gap-1 items-center">
                              {item.colors.map((color, i) => (
                                <TagBadge
                                  key={`col-${i}`}
                                  label={color}
                                  variant="color"
                                  editable
                                  onEdit={(newValue) => {
                                    const newColors = [...item.colors];
                                    newColors[i] = newValue;
                                    updateItem("interior", category, item.id, { colors: newColors });
                                  }}
                                  onRemove={() => {
                                    const newColors = item.colors.filter((_, idx) => idx !== i);
                                    updateItem("interior", category, item.id, { colors: newColors });
                                  }}
                                />
                              ))}
                              <AddTagInput
                                variant="color"
                                placeholder="+"
                                onAdd={(value) => {
                                  updateItem("interior", category, item.id, { colors: [...item.colors, value] });
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Room Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setRoomToDelete(null);
        }}
        onConfirm={deleteRoom}
        title="Delete Room"
        description={`Are you sure you want to delete "${(roomToDelete || selectedRoom)?.name}"? This will permanently remove all designs, images, and data associated with this room.`}
        confirmText="Delete Room"
        cancelText="Keep Room"
        variant="danger"
      />
    </div>
  );
}

// Loading fallback for Suspense
function DesignerPageLoading() {
  return (
    <div className="h-screen bg-zinc-950 text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-lime-400" />
        <p className="text-zinc-400">Loading designer...</p>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function DesignerPage() {
  return (
    <Suspense fallback={<DesignerPageLoading />}>
      <DesignerPageContent />
    </Suspense>
  );
}
