import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: false },
      { source: "/landing", destination: "/", permanent: false },
      { source: "/story", destination: "/", permanent: false },
      { source: "/mission", destination: "/", permanent: false },
      { source: "/manifesto", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
