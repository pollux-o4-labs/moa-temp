import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBasePath } from "../vite.config.ts";

test("Vite normalizes GitHub Pages base paths", () => {
  assert.equal(normalizeBasePath(""), "/");
  assert.equal(normalizeBasePath("/"), "/");
  assert.equal(normalizeBasePath("///"), "/");
  assert.equal(normalizeBasePath("/moa-temp"), "/moa-temp/");
  assert.equal(normalizeBasePath("moa-temp/"), "/moa-temp/");
  assert.equal(normalizeBasePath(undefined), "/");
});
