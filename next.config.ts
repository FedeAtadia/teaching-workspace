import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // OFFLINE-1: a save made without signal waits and goes through when it
    // returns, instead of failing; `useOffline` says when there is none.
    useOffline: true,
  },
};

export default withNextIntl(nextConfig);
