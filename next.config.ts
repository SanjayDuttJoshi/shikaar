import type { NextConfig } from "next";

/** GitHub Pages serves the game from /<repo-name>; the deploy script sets this, local builds stay at /. */
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "";

const NEXT_CONFIG: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  images: { unoptimized: true },
};

export default NEXT_CONFIG;
