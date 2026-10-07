import type { NextConfig } from "next";

// GitHub Pages: `PAGES_BASE_PATH=/killthebird next build` produces a static
// export in `out/` that is served from https://<user>.github.io/killthebird/.
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = basePath
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_BASE_PATH: basePath },
    }
  : {};

export default nextConfig;
