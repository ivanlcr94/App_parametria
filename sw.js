// ═══════════════════════════════════════════════════
//  SERVICE WORKER — Parametría Inyección de Plásticos
//  Estrategia: Cache First con actualización en background
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'parametria-v4';

// Recursos a cachear al instalar
const ASSETS = [
  './index.html',
  './estilos.css',
  './app.js',
  './pdf.js',
  './jspdf.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: cachear todos los recursos ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando recursos...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: eliminar caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando cache viejo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache First, luego red ──
self.addEventListener('fetch', event => {
  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Devolver desde cache Y actualizar en background
        const fetchUpdate = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, response.clone());
              });
            }
            return response;
          })
          .catch(() => {}); // sin internet: silencioso
        return cached;
      }
      // No está en cache: ir a la red
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Sin internet y sin cache: página de error mínima
          if (event.request.destination === 'document') {
            return new Response(
              '<h2 style="font-family:sans-serif;padding:20px;color:#f97316">⚙️ Parametría</h2>' +
              '<p style="font-family:sans-serif;padding:0 20px">Abrí la app al menos una vez con internet para usarla offline.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
        });
    })
  );
});
