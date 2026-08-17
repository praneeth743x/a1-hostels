import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development" && process.env.ENABLE_PWA !== "true",
  cacheOnFrontEndNav: true,
  workboxOptions: {
    disableDevLogs: true,
    navigateFallbackDenylist: [/^\/__/],
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
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
