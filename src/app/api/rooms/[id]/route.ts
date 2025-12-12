import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/rooms/[id] - Get a single room with its latest design
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", id)
      .single();

    if (roomError) {
      console.error("Error fetching room:", roomError);
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Also fetch the latest design for this room
    const { data: latestDesign } = await supabase
      .from("room_designs")
      .select("*")
      .eq("room_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      ...room,
      latest_design: latestDesign || null,
    });
  } catch (error) {
    console.error("Room GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 }
    );
  }
}

// PATCH /api/rooms/[id] - Update a room
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, thumbnail_url } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("rooms")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating room:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Room PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[id] - Delete a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase.from("rooms").delete().eq("id", id);

    if (error) {
      console.error("Error deleting room:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Room DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 }
    );
  }
}


