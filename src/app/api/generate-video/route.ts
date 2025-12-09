import { NextRequest, NextResponse } from "next/server";

// Force dynamic - prevents Next.js from caching this route
export const dynamic = "force-dynamic";

const FAL_API_KEY = process.env.FAL_KEY;
const MODEL_ENDPOINT = "fal-ai/veo3.1/fast/first-last-frame-to-video";

// Retry helper with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });
      return response;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Fetch attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// POST: Submit a new video generation job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      firstFrameUrl, 
      lastFrameUrl, 
      prompt,
      duration = "8s",
      aspectRatio = "auto",
      resolution = "720p",
      generateAudio = false,
    } = body;

    if (!firstFrameUrl || !lastFrameUrl || !prompt) {
      return NextResponse.json(
        { error: "firstFrameUrl, lastFrameUrl, and prompt are required" },
        { status: 400 }
      );
    }

    if (!FAL_API_KEY) {
      return NextResponse.json(
        { error: "FAL API key is not configured" },
        { status: 500 }
      );
    }

    // Submit to FAL queue with retry
    const submitResponse = await fetchWithRetry(
      `https://queue.fal.run/${MODEL_ENDPOINT}`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_frame_url: firstFrameUrl,
          last_frame_url: lastFrameUrl,
          prompt: prompt,
          duration: duration,
          aspect_ratio: aspectRatio,
          resolution: resolution,
          generate_audio: generateAudio,
        }),
      }
    );

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error("FAL submit error:", errorText);
      return NextResponse.json(
        { error: `FAL API error: ${submitResponse.status}` },
        { status: submitResponse.status }
      );
    }

    const submitData = await submitResponse.json();
    
    // Return the request ID immediately - client will poll for status
    return NextResponse.json({
      requestId: submitData.request_id,
      status: "SUBMITTED",
    });
  } catch (error) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { error: "Failed to submit video generation" },
      { status: 500 }
    );
  }
}

// GET: Check status of a video generation job
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId is required" },
        { status: 400 }
      );
    }

    if (!FAL_API_KEY) {
      return NextResponse.json(
        { error: "FAL API key is not configured" },
        { status: 500 }
      );
    }

    // Check status with retry
    const statusResponse = await fetchWithRetry(
      `https://queue.fal.run/${MODEL_ENDPOINT}/requests/${requestId}/status?logs=1`,
      {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
        },
      }
    );

    if (!statusResponse.ok) {
      return NextResponse.json(
        { error: "Failed to check status" },
        { status: statusResponse.status }
      );
    }

    const statusData = await statusResponse.json();

    if (statusData.status === "COMPLETED") {
      // Get the result with retry
      const resultResponse = await fetchWithRetry(
        `https://queue.fal.run/${MODEL_ENDPOINT}/requests/${requestId}`,
        {
          headers: {
            Authorization: `Key ${FAL_API_KEY}`,
          },
        }
      );

      if (resultResponse.ok) {
        const result = await resultResponse.json();
        return NextResponse.json({
          status: "COMPLETED",
          video: result.video,
          requestId,
        });
      }
    }

    // Return current status (IN_QUEUE, IN_PROGRESS, FAILED, etc.)
    return NextResponse.json({
      status: statusData.status,
      requestId,
      logs: statusData.logs,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Failed to check video status" },
      { status: 500 }
    );
  }
}
