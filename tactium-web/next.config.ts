import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `/bienvenida` era el carrusel de entrada de la web. La portada ya hace ese
  // papel (qué es TACTIUM + explorar + crear cuenta), así que redirige allí.
  async redirects() {
    return [{ source: "/bienvenida", destination: "/", permanent: true }];
  },
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
