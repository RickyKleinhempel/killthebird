import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    engine: "src/engine/index.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // The React entry is a client component; chunks are only ever loaded on the client.
  banner: { js: '"use client";' },
});
