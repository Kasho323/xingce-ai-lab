import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "mammoth", "@napi-rs/canvas"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};
export default config;
