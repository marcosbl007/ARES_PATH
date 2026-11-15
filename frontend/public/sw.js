const SHELL_CACHE = "ares-path-shell-v4";
const RUNTIME_CACHE = "ares-path-runtime-v4";
const API_CACHE = "ares-path-api-v4";
const DEVELOPMENT_MODE = new URL(self.location.href).searchParams.get("mode") === "dev";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/brand/ares-path-logo.png",
  "/brand/ares-path-logo-rectangular.png",
  "/brand/ares-path-icon-192.png",
  "/brand/ares-path-icon-512.png",
];

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isMarsTrekRequest(url) {
  return url.hostname === "trek.nasa.gov";
}

function isAllowedCrossOriginRequest(url) {
  return isApiRequest(url) || isMarsTrekRequest(url);
}

function isCacheableResponse(response) {
  return response && (response.ok || response.type === "opaque");
}

async function putInCache(cacheName, request, response) {
  if (!isCacheableResponse(response)) return response;

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, fallbackRequest) {
  try {
    const response = await fetch(request);
    await putInCache(cacheName, request, response);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackRequest) {
      const fallback = await caches.match(fallbackRequest);
      if (fallback) return fallback;
    }
    throw new Error("ARES PATH is offline and this resource is not cached.");
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  await putInCache(cacheName, request, response);
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(APP_SHELL.map(async (asset) => {
      try {
        const response = await fetch(new Request(asset, { cache: "no-store" }));
        if (isCacheableResponse(response)) await cache.put(asset, response);
      } catch {
        // Optional branding/manifest assets must not block the offline document.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("ares-path-") && ![SHELL_CACHE, RUNTIME_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();

  if (event.data && event.data.type === "CACHE_URLS" && Array.isArray(event.data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      await Promise.all(event.data.urls.map(async (rawUrl) => {
        try {
          const url = new URL(rawUrl, self.location.origin);
          if (url.origin !== self.location.origin || isApiRequest(url)) return;

          const request = new Request(url.href, { credentials: "same-origin" });
          const response = await fetch(request);
          if (isCacheableResponse(response)) await cache.put(request, response.clone());
        } catch {
          // A single optional asset must not prevent the rest of the shell from caching.
        }
      }));
    })());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isAllowedCrossOriginRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/"));
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (isMarsTrekRequest(url)) {
    // Orbital tiles are cached when visited, but are never required for a
    // saved local mission pack to open offline.
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (DEVELOPMENT_MODE && sameOrigin) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(cacheFirst(request, RUNTIME_CACHE));
});
