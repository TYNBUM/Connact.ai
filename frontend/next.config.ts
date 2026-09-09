import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // OAuth callbacks carry short-lived authorization codes in their query.
  logging: { incomingRequests: { ignore: [/\/api\/auth\//] } },
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default config;
