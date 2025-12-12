import { NextRequest, NextResponse } from "next/server";

// System prompt for interior design assistant
const SYSTEM_PROMPT = `You are an interior design assistant helping design specific rooms within a project.

The user will provide:
* The room name/type they are designing (e.g., "Living Room", "Master Bedroom", "Kitchen")
* 1 or more images of the actual space (optional - analyze these carefully if provided)
* Plain-text instructions about the vibe, style, or changes they want

Your job:
* Create a cohesive design concept specifically for that room type
* Suggest how to style the space with a strong focus on **materials** and **colors**
* Keep the **architecture/layout as-is** (no moving walls or windows)
* Respond **only** with a single JSON object in the exact structure below
* Be **concise**: short labels, short lists, max 4 items per subsection
* The "title" in meta should reflect the room + style (e.g., "Modern Minimalist Living Room")

## REQUIRED JSON STRUCTURE

Top level:
{
  "meta": {},
  "shell": {},
  "interior": {}
}

### 1. meta
"meta": {
  "title": "short concept name",
  "style_tags": ["few", "style", "keywords"],
  "summary": "1 short sentence for overall vibe"
}

### 2. shell
These keys MUST always exist inside "shell":
* ceiling
* walls
* floor
* windows_and_trims
* doors_and_trims
* built_ins

Each has this shape:
"<section_name>": {
  "materials_overall": ["high level material words"],
  "items": [ Item, Item, ... ]
}

If you have no ideas for a shell section, still include it as:
"<section_name>": {
  "materials_overall": [],
  "items": []
}

### 3. interior
These keys MUST always exist inside "interior":
* layout_and_zoning
* furniture
* lighting
* textiles
* decor_and_art

Same shape as shell sections.

## Item SHAPE (USED EVERYWHERE)
Every element in any items array MUST follow this shape:
{
  "id": "string_unique_slug",
  "label": "2–5 word title",
  "materials": ["core material words"],
  "colors": ["simple color words"]
}

Required fields for every item:
* id
* label
* materials
* colors

Rules:
* label must be short (max ~5 words).
* materials must be a list of 1–4 simple material descriptors
* colors must be a list of 1–4 simple color words/phrases
* Do not add any other fields
* Max 4 items per subsection

When the user is very specific and only asks for limited changes, produce a minimal JSON with only the relevant sections populated.`;

// JSON Schema for structured output
const DESIGN_JSON_SCHEMA = {
  name: "design_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      meta: {
        type: "object",
        properties: {
          title: { type: "string" },
          style_tags: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
        required: ["title", "style_tags", "summary"],
        additionalProperties: false,
      },
      shell: {
        type: "object",
        properties: {
          ceiling: { $ref: "#/$defs/category" },
          walls: { $ref: "#/$defs/category" },
          floor: { $ref: "#/$defs/category" },
          windows_and_trims: { $ref: "#/$defs/category" },
          doors_and_trims: { $ref: "#/$defs/category" },
          built_ins: { $ref: "#/$defs/category" },
        },
        required: ["ceiling", "walls", "floor", "windows_and_trims", "doors_and_trims", "built_ins"],
        additionalProperties: false,
      },
      interior: {
        type: "object",
        properties: {
          layout_and_zoning: { $ref: "#/$defs/category" },
          furniture: { $ref: "#/$defs/category" },
          lighting: { $ref: "#/$defs/category" },
          textiles: { $ref: "#/$defs/category" },
          decor_and_art: { $ref: "#/$defs/category" },
        },
        required: ["layout_and_zoning", "furniture", "lighting", "textiles", "decor_and_art"],
        additionalProperties: false,
      },
    },
    required: ["meta", "shell", "interior"],
    additionalProperties: false,
    $defs: {
      category: {
        type: "object",
        properties: {
          materials_overall: { type: "array", items: { type: "string" } },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                materials: { type: "array", items: { type: "string" } },
                colors: { type: "array", items: { type: "string" } },
              },
              required: ["id", "label", "materials", "colors"],
              additionalProperties: false,
            },
          },
        },
        required: ["materials_overall", "items"],
        additionalProperties: false,
      },
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, images, roomName } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Build the full prompt with room context
    let fullPrompt = prompt;
    if (roomName) {
      fullPrompt = `Room: ${roomName}\n\nDesign instructions: ${prompt}`;
    }

    // Build user message content - can include text and images
    const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [
      { type: "text", text: fullPrompt },
    ];

    // Add images if provided (base64 data URLs or regular URLs)
    if (images && Array.isArray(images) && images.length > 0) {
      for (const imageUrl of images) {
        if (typeof imageUrl === "string" && imageUrl.length > 0) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high", // Use high detail for interior design analysis
            },
          });
        }
      }
    }

    // Call OpenAI Chat Completions API with structured output
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-2024-08-06",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: DESIGN_JSON_SCHEMA,
        },
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Check for refusal
    if (data.choices?.[0]?.message?.refusal) {
      return NextResponse.json(
        { error: data.choices[0].message.refusal },
        { status: 400 }
      );
    }

    // Check for incomplete response
    if (data.choices?.[0]?.finish_reason === "length") {
      return NextResponse.json(
        { error: "Response was too long and got truncated. Please try a simpler prompt." },
        { status: 400 }
      );
    }

    // Parse the response content
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response content from OpenAI" },
        { status: 500 }
      );
    }

    let designJSON;
    try {
      designJSON = JSON.parse(content);
    } catch {
      console.error("Failed to parse JSON response:", content);
      return NextResponse.json(
        { error: "Invalid JSON response from OpenAI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      design: designJSON,
    });

  } catch (error) {
    console.error("Designer API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate design" },
      { status: 500 }
    );
  }
}


