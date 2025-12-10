import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/rooms/[id]/designs - Get all designs for a room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from("room_designs")
      .select("*")
      .eq("room_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching room designs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Room designs GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch room designs" },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[id]/designs - Save a new design for a room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { design_json, prompt, reference_image_urls, before_image_url, rendered_image_url } = body;

    if (!design_json) {
      return NextResponse.json(
        { error: "design_json is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("room_designs")
      .insert({
        room_id: id,
        design_json,
        prompt: prompt || null,
        reference_image_urls: reference_image_urls || [],
        before_image_url: before_image_url || null,
        rendered_image_url: rendered_image_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving room design:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Room designs POST error:", error);
    return NextResponse.json(
      { error: "Failed to save room design" },
      { status: 500 }
    );
  }
}

// PATCH /api/rooms/[id]/designs - Update the latest design for a room
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { design_id, design_json, before_image_url, rendered_image_url } = body;

    // Build the update object - only include fields that are provided
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (design_json !== undefined) updates.design_json = design_json;
    if (before_image_url !== undefined) updates.before_image_url = before_image_url;
    if (rendered_image_url !== undefined) updates.rendered_image_url = rendered_image_url;

    // If design_id provided, update that specific design
    // Otherwise, update the latest design for this room
    let designIdToUpdate = design_id;

    if (!designIdToUpdate) {
      const { data: latestDesign } = await supabase
        .from("room_designs")
        .select("id")
        .eq("room_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestDesign) {
        designIdToUpdate = latestDesign.id;
      } else {
        // No existing design, create a new one
        const { data, error } = await supabase
          .from("room_designs")
          .insert({
            room_id: id,
            design_json: design_json || {},
            before_image_url: before_image_url || null,
            rendered_image_url: rendered_image_url || null,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating room design:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
      }
    }

    const { data, error } = await supabase
      .from("room_designs")
      .update(updates)
      .eq("id", designIdToUpdate)
      .select()
      .single();

    if (error) {
      console.error("Error updating room design:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Room designs PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update room design" },
      { status: 500 }
    );
  }
}
