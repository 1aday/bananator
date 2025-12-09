export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      generated_images: {
        Row: {
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
        Insert: {
          id?: string;
          created_at?: string;
          project_id?: string | null;
          image_url: string;
          prompt: string;
          aspect_ratio: string;
          resolution: string;
          output_format: string;
          safety_filter: string;
          input_image_urls?: string[];
        };
        Update: {
          id?: string;
          created_at?: string;
          project_id?: string | null;
          image_url?: string;
          prompt?: string;
          aspect_ratio?: string;
          resolution?: string;
          output_format?: string;
          safety_filter?: string;
          input_image_urls?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "generated_images_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      reference_images: {
        Row: {
          id: string;
          created_at: string;
          project_id: string;
          url: string;
          filename: string | null;
          size_bytes: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          project_id: string;
          url: string;
          filename?: string | null;
          size_bytes?: number | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          project_id?: string;
          url?: string;
          filename?: string | null;
          size_bytes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "reference_images_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      prompt_categories: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          icon: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          icon: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          icon?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      prompt_templates: {
        Row: {
          id: string;
          created_at: string;
          category_id: string;
          name: string;
          prompt: string;
          description: string | null;
          use_count: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          category_id: string;
          name: string;
          prompt: string;
          description?: string | null;
          use_count?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          category_id?: string;
          name?: string;
          prompt?: string;
          description?: string | null;
          use_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_templates_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "prompt_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      video_flows: {
        Row: {
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
        Insert: {
          id?: string;
          created_at?: string;
          project_id?: string | null;
          before_image_url: string;
          after_image_url: string;
          video_url?: string | null;
          prompt: string;
          video_prompt: string;
          duration: string;
          resolution: string;
          status: "pending" | "generating" | "completed" | "failed";
        };
        Update: {
          id?: string;
          created_at?: string;
          project_id?: string | null;
          before_image_url?: string;
          after_image_url?: string;
          video_url?: string | null;
          prompt?: string;
          video_prompt?: string;
          duration?: string;
          resolution?: string;
          status?: "pending" | "generating" | "completed" | "failed";
        };
        Relationships: [
          {
            foreignKeyName: "video_flows_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_prompt_use_count: {
        Args: { prompt_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience types
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type GeneratedImage = Database["public"]["Tables"]["generated_images"]["Row"];
export type ReferenceImage = Database["public"]["Tables"]["reference_images"]["Row"];
export type PromptCategory = Database["public"]["Tables"]["prompt_categories"]["Row"] & {
  prompt_templates?: PromptTemplate[];
};
export type PromptTemplate = Database["public"]["Tables"]["prompt_templates"]["Row"] & {
  prompt_categories?: { name: string; icon: string };
};
export type VideoFlow = Database["public"]["Tables"]["video_flows"]["Row"];
