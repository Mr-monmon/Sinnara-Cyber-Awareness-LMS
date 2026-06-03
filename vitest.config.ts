import { defineConfig } from "vitest/config";

// Unit tests target the pure, isolated logic only (error normalization, gophish
// parsing, template variable rendering, form-field redaction). No DOM or DB is
// required, so the default node environment is used.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
