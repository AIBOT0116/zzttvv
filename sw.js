const STATIC_CACHE_NAME = "video-player-cache-v1";
const OFFLINE_CACHE_NAME = "offline-cache-v1";
const OFFLINE_URL = "/offline.html";

// List of assets to pre-cache
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    OFFLINE_URL,
    "https://akamaividz2.zee5.com/image/upload/w_1349,h_759,c_scale,f_webp,q_auto:eco/resources/0-9-zeetv/list/1920x1080listb9f9838f0ef34ac19ad1dd848ca976b6.jpg",
    "https://cdn.jsdelivr.net/npm/shaka-player/dist/shaka-player.ui.min.js",
    "https://cdn.jsdelivr.net/npm/shaka-player/dist/controls.min.css"
];

// INSTALL
self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            // Cache all static assets
            const staticCache = await caches.open(STATIC_CACHE_NAME);
            await staticCache.addAll(STATIC_ASSETS);

            // Cache offline fallback page with reload
            const offlineCache = await caches.open(OFFLINE_CACHE_NAME);
            await offlineCache.add(new Request(OFFLINE_URL, { cache: "reload" }));
        })()
    );
    self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map((cacheName) => {
                    if (![STATIC_CACHE_NAME, OFFLINE_CACHE_NAME].includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );

            // Enable navigation preload
            if ("navigationPreload" in self.registration) {
                await self.registration.navigationPreload.enable();
            }
        })()
    );
    self.clients.claim();
});

// FETCH
self.addEventListener("fetch", (event) => {
    const req = event.request;
    const url = new URL(req.url);
    const isSameOrigin = url.origin === location.origin;
    const isStaticAsset = /\.(html|css|js|json|png|jpg|jpeg|svg|webp)$/.test(url.pathname);
    const isCDNAsset = STATIC_ASSETS.includes(url.href);
    const isNavigation = req.mode === "navigate";

    // Only handle GET requests
    if (req.method !== "GET") return;

    event.respondWith(
        (async () => {
            // Navigation requests
            if (isNavigation) {
                try {
                    const preload = await event.preloadResponse;
                    if (preload) return preload;

                    return await fetch(req, { redirect: "follow" });

                } catch (error) {
                    const cache = await caches.open(OFFLINE_CACHE_NAME);
                    const fallback = await cache.match(OFFLINE_URL);
                    return fallback || Response.error();
                }
            }

            // Static or CDN asset requests
            if (isSameOrigin || isCDNAsset) {
                const cached = await caches.match(req);
                if (cached) return cached;

                try {
                    const response = await fetch(req);
                    const cache = await caches.open(STATIC_CACHE_NAME);
                    cache.put(req, response.clone());
                    return response;
                } catch (err) {
                    const cache = await caches.open(OFFLINE_CACHE_NAME);
                    return await cache.match(OFFLINE_URL);
                }
            }

            // Default fallback
            return fetch(req);
        })()
    );
});