/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const CACHE_NAME = 'barber-booth-pro-cache-v2'; // Incremented version
const urlsToCache = [
  // Core app shell
  '/',
  './index.html',
  './index.css',
  './index.tsx', // This might not be cacheable directly if it needs processing

  // Upscaler.js AI Model assets for offline performance
  'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/4x/+esm',
  'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/models/x4/model.json',
  'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0-beta.12/models/x4/group1-shard1of1.bin',
];

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if(!response || response.status !== 200) {
              return response;
            }
            
            // We don't cache responses from the genai API
            if (event.request.url.includes("generativelanguage.googleapis.com")) {
                return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

// Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
