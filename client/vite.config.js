import { defineConfig } from "vite";

export default defineConfig({
  base: "/projekttest/",
  build: {
    target: "es2020",
    sourcemap: true
  }
});
