import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const indexHtml = await readFile(
  new URL("../index.html", import.meta.url),
  "utf8"
);
const serviceWorkerRegistrationSource = await readFile(
  new URL("../src/pwa/register-service-worker.ts", import.meta.url),
  "utf8"
);
const manifestText = await readFile(
  new URL("../public/manifest.webmanifest", import.meta.url),
  "utf8"
);
const manifest = JSON.parse(manifestText);
const serviceWorker = await readFile(
  new URL("../public/sw.js", import.meta.url),
  "utf8"
);

test("the HTML entry points are safe under a Vite base path", () => {
  assert.match(
    indexHtml,
    /rel="manifest" href="%BASE_URL%manifest\.webmanifest"/
  );
  assert.match(indexHtml, /type="module" src="%BASE_URL%src\/main\.tsx"/);
  assert.doesNotMatch(indexHtml, /src="\/src\/main\.tsx"/);
});

test("the manifest exposes installable standalone metadata", async () => {
  assert.equal(manifest.name, "모아 | 나만의 하루 계획표");
  assert.equal(manifest.short_name, "모아");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);

  for (const icon of manifest.icons) {
    assert.match(icon.sizes, /^(192|512)x\1$/);
    assert.equal(icon.type, "image/svg+xml");
    assert.equal(icon.purpose, "any maskable");
    const iconText = await readFile(
      new URL(`../public/${icon.src.replace(/^\.\//, "")}`, import.meta.url),
      "utf8"
    );
    assert.match(iconText, /^<svg\s/);
  }
});

test("the service worker is install-only and makes no offline promises", () => {
  const executableServiceWorker = serviceWorker.replace(/\/\/.*$/gm, "");
  assert.match(serviceWorker, /addEventListener\("install"/);
  assert.match(serviceWorker, /addEventListener\("activate"/);
  assert.doesNotMatch(executableServiceWorker, /addEventListener\("fetch"/);
  assert.doesNotMatch(executableServiceWorker, /caches\.|\.sync\b/);
});

test("production builds retain service worker registration", () => {
  assert.match(serviceWorkerRegistrationSource, /import\.meta\.env\.MODE/);
  assert.doesNotMatch(
    serviceWorkerRegistrationSource,
    /import\.meta\.env\.PROD/
  );
});

test("service worker registration resolves both root and Pages paths", async () => {
  const { resolvePwaServiceWorker } =
    await import("../src/pwa/register-service-worker.ts");

  assert.deepEqual(resolvePwaServiceWorker("/", "https://example.test"), {
    scriptUrl: "https://example.test/sw.js",
    scope: "/",
  });
  assert.deepEqual(
    resolvePwaServiceWorker("/moa-temp/", "https://example.test"),
    {
      scriptUrl: "https://example.test/moa-temp/sw.js",
      scope: "/moa-temp/",
    }
  );
});
