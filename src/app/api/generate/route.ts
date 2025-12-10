import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import Replicate from "replicate";

// Use service role key for storage uploads (server-side only)
const supabaseAdmin =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

// Replicate client
const replicate = process.env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null;

const BUCKET_NAME = "generated-images";

async function uploadBufferToSupabase(
  buffer: ArrayBuffer | Buffer,
  fileName: string,
  contentType: string,
  retries = 3
): Promise<string | null> {
  if (!supabaseAdmin) {
    console.warn("Supabase admin client not configured - skipping upload");
    return null;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Wrap upload in a timeout (60 seconds)
      const uploadPromise = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType,
          cacheControl: "3600",
          upsert: attempt > 1, // Allow upsert on retries in case partial upload exists
        });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Upload timeout after 60s")), 60000);
      });

      const { error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);

      if (uploadError) {
        console.error(`Supabase upload error (attempt ${attempt}/${retries}):`, uploadError);
        if (attempt === retries) return null;
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error(`Failed to upload to Supabase (attempt ${attempt}/${retries}):`, error);
      if (attempt === retries) return null;
      // Wait before retry
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  return null;
}

async function uploadImageToSupabaseFromUrl(
  imageUrl: string,
  outputFormat: string,
  prefix: string
) {
  // Add timeout to prevent hanging on slow/unreachable URLs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("Failed to download image for upload");
    }

    const imageBuffer = await response.arrayBuffer();
    const fileName = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${outputFormat}`;
    const contentType = `image/${
      outputFormat === "jpg" ? "jpeg" : outputFormat
    }`;

    return uploadBufferToSupabase(imageBuffer, fileName, contentType);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL format");
  }
  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const extension = contentType.split("/")[1] || "png";

  return { buffer, contentType, extension };
}

/**
 * Compress and convert image to PNG using sharp
 * - Lossless PNG compression
 * - Strips metadata to reduce size
 * - Optionally resizes if image is very large
 */
async function compressAndConvertToPng(
  inputBuffer: Buffer,
  maxDimension = 4096
): Promise<Buffer> {
  try {
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    // Resize if larger than maxDimension while maintaining aspect ratio
    let pipeline = image;
    if (
      metadata.width &&
      metadata.height &&
      (metadata.width > maxDimension || metadata.height > maxDimension)
    ) {
      pipeline = pipeline.resize(maxDimension, maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to PNG with lossless compression
    const compressedBuffer = await pipeline
      .png({
        compressionLevel: 9, // Max compression (0-9)
        palette: false, // Keep full color, no palette reduction
        effort: 10, // Max effort for compression
      })
      .toBuffer();

    return compressedBuffer;
  } catch (error) {
    console.warn("Image compression failed, using original:", error);
    return inputBuffer;
  }
}

async function ensureImageUrls(
  imageInputs: string[],
  compressImages = true
): Promise<string[]> {
  const urls: string[] = [];

  for (const input of imageInputs) {
    if (input.startsWith("http")) {
      // For HTTP URLs, optionally fetch and compress
      if (compressImages && supabaseAdmin) {
        try {
          const response = await fetch(input, {
            signal: AbortSignal.timeout(30000),
          });
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const originalBuffer = Buffer.from(arrayBuffer);
            const compressedBuffer = await compressAndConvertToPng(originalBuffer);
            const fileName = `inputs/${Date.now()}-${crypto.randomUUID()}.png`;
            const uploadedUrl = await uploadBufferToSupabase(
              compressedBuffer,
              fileName,
              "image/png"
            );
            if (uploadedUrl) {
              urls.push(uploadedUrl);
              continue;
            }
          }
        } catch (error) {
          console.warn("Could not compress HTTP image, using original URL:", error);
        }
      }
      // Fallback to original URL
      urls.push(input);
    } else if (input.startsWith("data:")) {
      const { buffer } = parseDataUrl(input);
      
      // Try to compress and upload
      if (compressImages && supabaseAdmin) {
        try {
          const compressedBuffer = await compressAndConvertToPng(buffer);
          const fileName = `inputs/${Date.now()}-${crypto.randomUUID()}.png`;
          const uploadedUrl = await uploadBufferToSupabase(
            compressedBuffer,
            fileName,
            "image/png"
          );
          if (uploadedUrl) {
            urls.push(uploadedUrl);
            continue;
          }
        } catch (error) {
          console.warn("Could not compress data URL image:", error);
        }
      }
      
      // Fallback: use original data URL (FAL accepts these)
      urls.push(input);
    } else {
      throw new Error("Unsupported image input format. Use URLs or data URIs.");
    }
  }

  return urls;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      imageInputs,
      resolution,
      aspectRatio,
      outputFormat,
      numImages,
      limitGenerations,
      enableWebSearch,
      syncMode,
      imageSize,
      compressImages = true,
      model = "nano-banana-pro", // "nano-banana-pro", "seedream", "google-nano-banana"
    } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const format = outputFormat || "png";
    const hasImages = imageInputs && Array.isArray(imageInputs) && imageInputs.length > 0;
    
    const selectedModel = model;

    // ============================================
    // GOOGLE NANO-BANANA (Replicate)
    // ============================================
    if (selectedModel === "google-nano-banana") {
      if (!replicate) {
        return NextResponse.json(
          { error: "REPLICATE_API_TOKEN is not configured on the server" },
          { status: 500 }
        );
      }

      // Prepare image URLs for Replicate
      let imageUrls: string[] = [];
      if (hasImages) {
        imageUrls = await ensureImageUrls(imageInputs.slice(0, 10), compressImages);
      }

      // Map aspect ratio to Replicate format
      const replicateAspectRatio = mapAspectRatioForReplicate(aspectRatio, hasImages);

      const input: {
        prompt: string;
        image_input?: string[];
        aspect_ratio?: string;
        output_format?: string;
      } = {
        prompt,
        output_format: format,
      };

      if (imageUrls.length > 0) {
        input.image_input = imageUrls;
      }

      if (replicateAspectRatio) {
        input.aspect_ratio = replicateAspectRatio;
      }

      const output = await replicate.run("google/nano-banana", { input });
      
      // Handle the output - it returns a FileOutput object
      let replicateImageUrl: string;
      if (output && typeof output === 'object' && 'url' in output) {
        replicateImageUrl = (output as { url: () => string }).url();
      } else if (typeof output === 'string') {
        replicateImageUrl = output;
      } else {
        throw new Error("Unexpected output format from Replicate");
      }

      let finalImageUrl = replicateImageUrl;

      // Upload to Supabase for persistence
      if (supabaseAdmin && replicateImageUrl) {
        try {
          const uploaded = await uploadImageToSupabaseFromUrl(
            replicateImageUrl,
            format,
            "generated"
          );
          if (uploaded) {
            finalImageUrl = uploaded;
          }
        } catch (uploadError) {
          console.warn("Failed to upload to Supabase, using original URL:", uploadError);
        }
      }

      return NextResponse.json({
        success: true,
        imageUrl: finalImageUrl,
        prompt,
        settings: {
          aspectRatio: replicateAspectRatio || "match_input_image",
          outputFormat: format,
        },
        sourceUrl: replicateImageUrl,
        inputImageUrls: imageUrls,
        model: "google/nano-banana",
      });
    }

    // ============================================
    // FAL MODELS (Nano Banana Pro / Seedream)
    // ============================================
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY is not configured on the server" },
        { status: 500 }
      );
    }

    let falResponse: Response;
    let imageUrls: string[] = [];

    if (selectedModel === "nano-banana-pro") {
      // Use nano-banana-pro/edit for image-to-image editing
      if (!hasImages) {
        return NextResponse.json(
          { error: "At least one image is required for nano-banana-pro edit mode" },
          { status: 400 }
        );
      }
      imageUrls = await ensureImageUrls(imageInputs.slice(0, 10), compressImages);

      falResponse = await fetch(
        "https://fal.run/fal-ai/nano-banana-pro/edit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${process.env.FAL_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            image_urls: imageUrls,
            num_images: Math.min(numImages || 1, 4),
            aspect_ratio: aspectRatio || "auto",
            output_format: format,
            resolution: resolution || "2K",
            limit_generations: !!limitGenerations,
            enable_web_search: !!enableWebSearch,
            sync_mode: !!syncMode,
          }),
        }
      );
    } else {
      // Use Bytedance Seedream 4.5 for text-to-image generation
      falResponse = await fetch(
        "https://fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${process.env.FAL_KEY}`,
          },
          body: JSON.stringify({
            prompt,
            image_size: imageSize || "auto_2K",
            num_images: Math.min(numImages || 1, 6),
            enable_safety_checker: true,
            sync_mode: !!syncMode,
          }),
        }
      );
    }

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      throw new Error(
        `Fal request failed (${falResponse.status}): ${errorText}`
      );
    }

    const falResult: {
      images?: { url: string }[];
      description?: string;
      seed?: number;
    } = await falResponse.json();

    const firstImageUrl = falResult.images?.[0]?.url;

    if (!firstImageUrl) {
      throw new Error("No image URL returned from Fal");
    }

    let finalImageUrl = firstImageUrl;

    if (supabaseAdmin) {
      try {
        const uploaded = await uploadImageToSupabaseFromUrl(
          firstImageUrl,
          format,
          "generated"
        );
        if (uploaded) {
          finalImageUrl = uploaded;
        }
      } catch (uploadError) {
        console.warn("Failed to upload to Supabase, using original URL:", uploadError);
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: finalImageUrl,
      prompt,
      settings: {
        aspectRatio: aspectRatio || "auto",
        resolution: resolution || "1K",
        outputFormat: format,
        imageSize: imageSize || "auto_2K",
      },
      sourceUrl: firstImageUrl,
      inputImageUrls: imageUrls,
      model: selectedModel === "seedream" ? "bytedance/seedream/v4.5" : "nano-banana-pro/edit",
      seed: falResult.seed,
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image" },
      { status: 500 }
    );
  }
}

// Map aspect ratio to Replicate's supported values
function mapAspectRatioForReplicate(ratio: string | undefined, hasImages: boolean): string {
  if (!ratio || ratio === "auto") {
    return hasImages ? "match_input_image" : "1:1";
  }
  
  // Replicate supports: match_input_image, 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
  const replicateRatios = ["match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
  
  if (replicateRatios.includes(ratio)) {
    return ratio;
  }
  
  // Map any non-supported ratios
  return hasImages ? "match_input_image" : "1:1";
}
