import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA({
  dest: "public",
  register: true,
  // No API routes and no server-fetched data (session-store.ts / match-log-store.ts
  // are entirely localStorage-backed) — there's no server response that's ever
  // "fresher" than what's cached, so the default cache-first asset strategy needs
  // no custom runtime-caching rules for this app.
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})(nextConfig);
