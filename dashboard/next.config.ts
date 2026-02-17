import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/experiments',
        permanent: true,
      },
      {
        source: '/dashboard/site/:siteId',
        destination: '/experiments/site/:siteId',
        permanent: true,
      },
      {
        source: '/analysis',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
