import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: (() => {
      const patterns: { protocol: "https"; hostname: string; pathname: string }[] = [
        {
          protocol: "https",
          hostname: "storage.googleapis.com",
          pathname: "/**",
        },
      ];

      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        try {
          const hostname = new URL(
            process.env.NEXT_PUBLIC_SUPABASE_URL
          ).hostname;
          patterns.push({
            protocol: "https",
            hostname,
            pathname: "/**",
          });
        } catch {
          // ignore malformed supabase url
        }
      }

      return patterns;
    })(),
  },
};

export default nextConfig;
