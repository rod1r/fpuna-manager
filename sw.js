const precacheManifest = self.__WB_MANIFEST;

function hashManifest(manifest) {
  let hash = 2166136261;
  for (const entry of manifest) {
    for (const character of `${entry.url}:${entry.revision ?? ""}`) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    }
  }
  return (hash >>> 0).toString(36);
}

const cacheVersion = hashManifest(precacheManifest);
const precacheName = `fpuna-manager-precache-${cacheVersion}`;
const runtimeName = `fpuna-manager-runtime-${cacheVersion}`;
const staticName = `fpuna-manager-static-${cacheVersion}`;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(precacheName);
    const urls = [...new Set(precacheManifest.map(({ url }) => new URL(url, self.registration.scope).href))];
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const activeCaches = new Set([precacheName, runtimeName, staticName]);
    const oldCaches = (await caches.keys()).filter((name) =>
      (name.startsWith("fpuna-manager-") && !activeCaches.has(name)) || name.startsWith("workbox-precache-"),
    );
    await Promise.all(oldCaches.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, event) {
  const runtimeCache = await caches.open(runtimeName);
  try {
    const response = await fetch(request);
    if (response.ok) event.waitUntil(runtimeCache.put(request, response.clone()));
    return response;
  } catch {
    const cachedResponse = await runtimeCache.match(request) ?? await caches.match(request);
    if (cachedResponse) return cachedResponse;
    if (request.mode === "navigate") {
      const appEntry = new URL("./index.html", self.registration.scope);
      return await caches.match(appEntry.href) ?? Response.error();
    }
    return Response.error();
  }
}

async function cacheFirst(request, event) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      const cache = await caches.open(staticName);
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  } catch {
    return Response.error();
  }
}

function isAppCodeRequest(request, url) {
  return url.origin === self.location.origin &&
    (request.mode === "navigate" ||
      ["document", "script", "style"].includes(request.destination) ||
      /\.(?:html|css|js)$/i.test(url.pathname));
}

function isStaticRequest(request, url) {
  if (url.origin !== self.location.origin) {
    return ["font", "image", "script", "style"].includes(request.destination);
  }
  return ["font", "image"].includes(request.destination) ||
    /\.(?:json|png|svg|ico|webp|woff2?|ttf|otf)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isAppCodeRequest(request, url)) {
    event.respondWith(networkFirst(request, event));
  } else if (isStaticRequest(request, url)) {
    event.respondWith(cacheFirst(request, event));
  }
});
