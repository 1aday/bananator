/**
 * Client-side utility functions for handling images
 */

import { supabase } from "./supabase";

/**
 * Upload a data URL to Supabase storage and return the public URL
 * This prevents "request too large" errors by uploading images before sending to API
 */
export async function uploadDataUrlToSupabase(
  dataUrl: string,
  prefix = "uploads"
): Promise<string> {
  // If it's already a URL, return it
  if (!dataUrl.startsWith("data:")) {
    return dataUrl;
  }

  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Generate unique filename
    const fileName = `${prefix}/${Date.now()}-${crypto.randomUUID()}.png`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(fileName, blob, {
        contentType: "image/png",
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Failed to upload data URL to Supabase:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("generated-images")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading data URL:", error);
    throw error;
  }
}

/**
 * Upload multiple data URLs to Supabase storage
 * Returns an array of URLs (or original URLs if they're already URLs)
 */
export async function uploadDataUrlsToSupabase(
  imageInputs: string[],
  prefix = "uploads"
): Promise<string[]> {
  const uploadPromises = imageInputs.map((input) =>
    uploadDataUrlToSupabase(input, prefix).catch((error) => {
      console.error("Failed to upload image, using original:", error);
      // If upload fails, return original (might be a URL already)
      return input;
    })
  );

  return Promise.all(uploadPromises);
}

