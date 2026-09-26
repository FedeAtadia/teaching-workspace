import { defineConfig } from "vitest/config";

/**
 * Node environment: everything tested so far is pure logic under `src/lib` and
 * `src/i18n`. Add jsdom and @vitejs/plugin-react when the first component test
 * arrives (see the MTG Life Counter's config for the shape).
 *
 * `resolve.tsconfigPaths` makes `@/` imports resolve the same way they do in
 * `next build`.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
