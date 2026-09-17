// This worker exists for installability only. It deliberately does not cache,
// intercept fetches, or schedule background synchronization.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
