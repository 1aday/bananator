import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublicKey) {
  console.error(
    "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || "",
  supabasePublicKey || ""
);

// ============================================
// PROJECT FUNCTIONS
// ============================================

export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export async function createProject(data: {
  name: string;
  description?: string;
}): Promise<Project> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: data.name,
      description: data.description || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }
  return project;
}

export async function getProjects(): Promise<Project[]> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
  return data || [];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch project: ${error.message}`);
  }
  return data;
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string }
): Promise<Project> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update project: ${error.message}`);
  }
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}

// ============================================
// REFERENCE IMAGE FUNCTIONS
// ============================================

export type ReferenceImage = {
  id: string;
  project_id: string;
  url: string;
  filename: string | null;
  size_bytes: number | null;
  created_at: string;
};

export async function saveReferenceImage(data: {
  projectId: string;
  url: string;
  filename?: string;
  sizeBytes?: number;
}): Promise<ReferenceImage> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { data: refImage, error } = await supabase
    .from("reference_images")
    .insert({
      project_id: data.projectId,
      url: data.url,
      filename: data.filename || null,
      size_bytes: data.sizeBytes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save reference image: ${error.message}`);
  }
  return refImage;
}

export async function getReferenceImages(
  projectId: string
): Promise<ReferenceImage[]> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("reference_images")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch reference images: ${error.message}`);
  }
  return data || [];
}

export async function deleteReferenceImage(id: string): Promise<void> {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("reference_images").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete reference image: ${error.message}`);
  }
}

// ============================================
// GENERATED IMAGE FUNCTIONS
// ============================================

export async function saveGeneratedImage(data: {
  projectId: string | null;
  imageUrl: string;
  prompt: string;
  settings?: {
    aspectRatio?: string;
    resolution?: string;
    outputFormat?: string;
    safetyFilter?: string;
  };
  inputImageUrls?: string[];
}) {
  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(
      "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY environment variables."
    );
  }

  const { data: image, error } = await supabase
    .from("generated_images")
    .insert({
      project_id: data.projectId,
      image_url: data.imageUrl,
      prompt: data.prompt,
      aspect_ratio: data.settings?.aspectRatio || "auto",
      resolution: data.settings?.resolution || "2K",
      output_format: data.settings?.outputFormat || "png",
      safety_filter: data.settings?.safetyFilter || "moderate",
      input_image_urls: data.inputImageUrls || [],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Supabase error: ${error.message} (code: ${error.code})`);
  }
  return image;
}

export type GeneratedImage = {
  id: string;
  created_at: string;
  project_id: string | null;
  image_url: string;
  prompt: string;
  aspect_ratio: string;
  resolution: string;
  output_format: string;
  safety_filter: string;
  input_image_urls: string[];
};

export async function getGeneratedImages(projectId?: string | null, limit = 50): Promise<GeneratedImage[]> {
  let query = supabase
    .from("generated_images")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.eq("project_id", projectId);
  } else if (projectId === null) {
    // Get images without a project (draw-to-edit images)
    query = query.is("project_id", null);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as GeneratedImage[];
}

export async function deleteGeneratedImage(id: string) {
  // First get the image to extract the filename from URL
  const { data: image, error: fetchError } = await supabase
    .from("generated_images")
    .select("image_url")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  // Delete from database
  const { error } = await supabase
    .from("generated_images")
    .delete()
    .eq("id", id);

  if (error) throw error;

  // Try to delete from storage (extract filename from URL)
  if (image?.image_url) {
    try {
      const url = new URL(image.image_url);
      const pathParts = url.pathname.split("/");
      const fileName = pathParts[pathParts.length - 1];
      
      if (fileName) {
        await supabase.storage
          .from("generated-images")
          .remove([fileName]);
      }
    } catch (e) {
      // Storage deletion is best-effort, don't fail if it doesn't work
      console.warn("Could not delete from storage:", e);
    }
  }
}

// Helper functions for prompt library
export async function getPromptCategories() {
  const { data, error } = await supabase
    .from("prompt_categories")
    .select("*, prompt_templates(*)")
    .order("name");

  if (error) throw error;
  return data;
}

export async function getPromptTemplates(categoryId?: string) {
  let query = supabase
    .from("prompt_templates")
    .select("*, prompt_categories(name, icon)")
    .order("use_count", { ascending: false });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function incrementPromptUseCount(id: string) {
  const { error } = await supabase.rpc("increment_prompt_use_count", {
    prompt_id: id,
  });

  if (error) throw error;
}

export async function createPromptTemplate(data: {
  name: string;
  prompt: string;
  categoryId: string;
  description?: string;
}) {
  const { data: template, error } = await supabase
    .from("prompt_templates")
    .insert({
      name: data.name,
      prompt: data.prompt,
      category_id: data.categoryId,
      description: data.description,
    })
    .select()
    .single();

  if (error) throw error;
  return template;
}

// ============================================
// VIDEO FLOW FUNCTIONS
// ============================================

export type VideoFlow = {
  id: string;
  created_at: string;
  project_id: string | null;
  before_image_url: string;
  after_image_url: string;
  video_url: string | null;
  prompt: string;
  video_prompt: string;
  duration: string;
  resolution: string;
  status: "pending" | "generating" | "completed" | "failed";
};

export async function createVideoFlow(data: {
  projectId?: string | null;
  beforeImageUrl: string;
  afterImageUrl: string;
  prompt: string;
  videoPrompt?: string;
  duration?: string;
  resolution?: string;
}) {
  const { data: videoFlow, error } = await supabase
    .from("video_flows")
    .insert({
      project_id: data.projectId || null,
      before_image_url: data.beforeImageUrl,
      after_image_url: data.afterImageUrl,
      prompt: data.prompt,
      video_prompt: data.videoPrompt || "make a timelapse of this construction, camera stays stationary",
      duration: data.duration || "8s",
      resolution: data.resolution || "720p",
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create video flow: ${error.message} (code: ${error.code})`);
  }
  return videoFlow as VideoFlow;
}

export async function updateVideoFlow(
  id: string,
  data: {
    videoUrl?: string;
    status?: "pending" | "generating" | "completed" | "failed";
  }
) {
  const { data: videoFlow, error } = await supabase
    .from("video_flows")
    .update({
      video_url: data.videoUrl,
      status: data.status,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update video flow: ${error.message} (code: ${error.code})`);
  }
  return videoFlow as VideoFlow;
}

export async function getVideoFlows(projectId?: string | null, limit = 50) {
  let query = supabase
    .from("video_flows")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.eq("project_id", projectId);
  } else if (projectId === null) {
    query = query.is("project_id", null);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as VideoFlow[];
}

export async function deleteVideoFlow(id: string) {
  const { error } = await supabase
    .from("video_flows")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
