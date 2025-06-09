const CACHE_NAME = "video-player-cache-v1";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    "/offline.html",  // Add your offline fallback page here
    "https://akamaividz2.zee5.com/image/upload/w_1349,h_759,c_scale,f_webp,q_auto:eco/resources/0-9-zeetv/list/1920x1080listb9f9838f0ef34ac19ad1dd848ca976b6.jpg"
];

// Optional: You can pre-cache these third-party libraries, or let them be cached on demand
const CDN_ASSETS = [
    "https://cdn.jsdelivr.net/npm/shaka-player/dist/shaka-player.ui.min.js",
    "https://cdn.jsdelivr.net/npm/shaka-player/dist/controls.min.css"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([...STATIC_ASSETS, ...CDN_ASSETS]);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Only cache GET requests
    if (req.method !== "GET") return;

    const isSameOrigin = url.origin === location.origin;
    const isStaticFile = /\.(html|css|js|json|png|jpg|jpeg|svg|webp)$/.test(url.pathname);
    const isNavigationRequest = req.mode === 'navigate';

    if ((isSameOrigin && isStaticFile) || CDN_ASSETS.includes(url.href)) {
        event.respondWith(
            caches.match(req).then((cachedResponse) => {
                return (
                    cachedResponse ||
                    fetch(req).then((networkResponse) => {
                        return caches.open(CACHE_NAME).then((cache) => {
                            cache.put(req, networkResponse.clone());
                            return networkResponse;
                        });
                    }).catch(() => {
                        // If the fetch fails (offline), and it's a navigation request, serve offline page
                        if (isNavigationRequest) {
                            return caches.match('/offline.html');
                        }
                    })
                );
            })
        );
    } else if (isNavigationRequest) {
        // For navigation requests not in cache or CDN, fallback to offline page
        event.respondWith(
            fetch(req).catch(() => caches.match('/offline.html'))
        );
    }
});