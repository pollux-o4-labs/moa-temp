const SERVICE_WORKER_FILE = "sw.js";

export function resolvePwaServiceWorker(baseUrl: string, origin: string) {
  const appBase = new URL(baseUrl, origin);
  return {
    scriptUrl: new URL(SERVICE_WORKER_FILE, appBase).href,
    scope: appBase.pathname,
  };
}

export function registerPwaServiceWorker() {
  if (
    import.meta.env.MODE !== "production" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const { scriptUrl, scope } = resolvePwaServiceWorker(
    import.meta.env.BASE_URL,
    window.location.origin
  );
  void navigator.serviceWorker.register(scriptUrl, { scope }).catch(() => {
    // A browser that cannot register a worker must continue as a normal SPA.
  });
}
