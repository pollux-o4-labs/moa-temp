import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("./", import.meta.url));

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export function normalizeBasePath(value: unknown): string {
  if (typeof value !== "string") return "/";

  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";

  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}/` : "/";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH),
    resolve: {
      alias: {
        "@": path.resolve(projectRoot),
      },
    },
    plugins: [react()],
    server: {
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      emptyOutDir: true,
    },
  };
});
