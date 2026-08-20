import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: false,
  skipWaiting: false,
  disable: true, // Clean manual SW management in public/sw.js
  cacheOnFrontEndNav: false,
  reloadOnOnline: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['firebase-admin'],
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 1800,
    },
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ? [
            `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.web.app`,
            `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`
          ]
        : ['*']
    },
  },
  async rewrites() {
    return [
      {
        source: '/teammember',
        destination: '/pgowner/dashboard',
      },
      {
        source: '/teammember/:path*',
        destination: '/pgowner/:path*',
      },
    ];
  },
  turbopack: {},
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withPWA(nextConfig);
