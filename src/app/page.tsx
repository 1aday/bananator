"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectSelector } from "@/components/project-selector";
import type { Project } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

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
    router.push(`/project/${project.id}`);
  };

  return (
    <ProjectSelector
      onSelectProject={handleSelectProject}
      currentProjectId={null}
    />
  );
}
