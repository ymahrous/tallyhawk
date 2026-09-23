import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", ".next-e2e/**", "e2e/**"],
    // lib/api.ts reads this at import time; test/api-mock.ts routes requests for this origin.
    env: { NEXT_PUBLIC_API_URL: "http://api.test" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html", "lcov"],
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        // Satori/ImageResponse renders at build time and is covered by the e2e SEO suite instead.
        "lib/og.tsx",
        "app/**/opengraph-image.tsx",
        // Generated shadcn primitives with no app-specific logic.
        "components/ui/{badge,button,card,separator,skeleton,table}.tsx",
      ],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 80,
        lines: 85,
      },
    },
  },
});
