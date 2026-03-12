import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/services/setup-import.service.ts",
        "src/lib/schemas/setup-import.schema.ts",
        "src/app/api/setup/**/route.ts",
      ],
      reporter: ["text"],
      thresholds: {
        lines: 85,
        branches: 75,
        functions: 85,
        statements: 85,
      },
    },
  },
});
