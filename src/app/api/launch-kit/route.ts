import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a practical launch strategist who turns any idea into a scannable content kit.

Rules:
- Keep everything concise and skimmable.
- Avoid fluff. Prefer bullets and tight sentences.
- Tone should match the user request (e.g., bold, friendly, analytical).
- Visual prompts must be literal and detailed enough for image generation.
- Platform guidance should be native to that channel (e.g., TikTok: hook + punchy lines, LinkedIn: structured value + CTA).

Required JSON shape:
{
  "idea_summary": "short summary of what is being promoted",
  "target_audience": "who it's for",
  "goal": "goal in a short phrase",
  "angle": "the core angle to emphasize",
  "voice": "tone/voice to use",
  "headline_options": ["3 to 4 hooky headlines"],
  "keywords": ["5 to 8 keywords to weave in"],
  "visual_prompt": "detailed image prompt for a marketing key visual",
  "visual_style": "style notes for the image",
  "platforms": [
    {
      "name": "tiktok | instagram | x | linkedin | email",
      "hook": "1-liner hook",
      "body": "2-5 compact lines or bullets",
      "cta": "clear CTA",
      "hashtags": ["up to 6 tags suited to that channel"],
      "notes": "channel-specific notes"
    }
  ],
  "email_blurb": "2-3 sentence email/newsletter version"
}`;

const LAUNCH_KIT_SCHEMA = {
  name: "launch_kit",
  strict: true,
  schema: {
    type: "object",
    properties: {
      idea_summary: { type: "string" },
      target_audience: { type: "string" },
      goal: { type: "string" },
      angle: { type: "string" },
      voice: { type: "string" },
      headline_options: { type: "array", items: { type: "string" } },
      keywords: { type: "array", items: { type: "string" } },
      visual_prompt: { type: "string" },
      visual_style: { type: "string" },
      platforms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            hook: { type: "string" },
            body: { type: "string" },
            cta: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
          required: ["name", "hook", "body", "cta", "hashtags", "notes"],
          additionalProperties: false,
        },
      },
      email_blurb: { type: "string" },
    },
    required: [
      "idea_summary",
      "target_audience",
      "goal",
      "angle",
      "voice",
      "headline_options",
      "keywords",
      "visual_prompt",
      "visual_style",
      "platforms",
      "email_blurb",
    ],
    additionalProperties: false,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      idea,
      audience,
      goal,
      platforms,
      tone,
      style,
      extras,
    }: {
      idea?: string;
      audience?: string;
      goal?: string;
      platforms?: string[];
      tone?: string;
      style?: string;
      extras?: string;
    } = body;

    if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
      return NextResponse.json(
        { error: "Idea or product description is required." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const selectedPlatforms =
      Array.isArray(platforms) && platforms.length > 0
        ? platforms.slice(0, 5)
        : ["tiktok", "instagram", "x", "linkedin"];

    const userPrompt = [
      `Idea or product: ${idea}`.trim(),
      audience ? `Audience: ${audience}` : null,
      goal ? `Goal: ${goal}` : null,
      tone ? `Voice: ${tone}` : null,
      style ? `Visual style hints: ${style}` : null,
      extras ? `Extra constraints: ${extras}` : null,
      `Platforms to cover: ${selectedPlatforms.join(", ")}`,
      "Keep it concise and ready to paste.",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-2024-08-06",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: LAUNCH_KIT_SCHEMA,
        },
        temperature: 0.65,
        max_tokens: 800,
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
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response content from OpenAI" },
        { status: 500 }
      );
    }

    let kit;
    try {
      kit = JSON.parse(content);
    } catch (err) {
      console.error("Failed to parse launch kit JSON:", content, err);
      return NextResponse.json(
        { error: "Invalid JSON response from OpenAI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      kit,
    });
  } catch (error) {
    console.error("Launch kit API error:", error);
    return NextResponse.json(
      { error: "Failed to build launch kit" },
      { status: 500 }
    );
  }
}
