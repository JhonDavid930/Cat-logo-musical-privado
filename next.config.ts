import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["mammoth", "exceljs", "yauzl", "yazl"],
  outputFileTracingIncludes: {
    "/api/documents/*": [
      "./scripts/preview-document.cjs",
      "./node_modules/mammoth/**/*",
      "./node_modules/exceljs/**/*",
      "./node_modules/yauzl/**/*",
    ],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./private/**/*",
      "./.tools/**/*",
      "./cover-art/**/*",
      "./invoices/**/*",
      "./music-analysis/**/*",
      "./test-results/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/documents/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};
export default config;
