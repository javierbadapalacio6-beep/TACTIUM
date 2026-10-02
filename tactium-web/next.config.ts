import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enlaces universales (iOS) y App Links (Android). El fichero de Apple no
  // lleva extensión y tiene que servirse como JSON o iOS lo ignora.
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
