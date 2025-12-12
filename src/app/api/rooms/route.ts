import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/rooms - Get all rooms, optionally filtered by project_id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    let query = supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching rooms:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Rooms GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

// POST /api/rooms - Create a new room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, name, description } = body;

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Room name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        project_id,
        name: name.trim(),
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating room:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Rooms POST error:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}


