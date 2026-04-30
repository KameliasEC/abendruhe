/* ============================================
   SERVICE WORKER für Abendruhe
   Sorgt dafür, dass die App auch offline läuft.
   ============================================ */

const CACHE_NAME = 'abendruhe-v1';

// Diese Dateien werden beim ersten Besuch lokal gespeichert
const FILES_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// 1) Bei der Installation: Dateien herunterladen und speichern
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2) Wenn eine neue Version aktiv wird: alte Caches löschen
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 3) Bei jeder Anfrage: erst im Cache schauen, sonst aus dem Netz holen
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
