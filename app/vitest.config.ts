import { defineConfig } from "vitest/config";

// Only pure domain code is unit-tested; screens are checked on device.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node" } });
