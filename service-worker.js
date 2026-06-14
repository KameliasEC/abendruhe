/* ============================================
   SERVICE WORKER für Abendruhe
   Sorgt dafür, dass die App auch offline läuft
   und Push-Notifications empfängt.
   ============================================ */

const CACHE_NAME = 'abendruhe-v4';

// Diese Dateien werden beim ersten Besuch lokal gespeichert
const FILES_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './audio/meditation.m4a'
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

/* ============================================
   PUSH-NOTIFICATIONS
   ============================================ */

// 4) Push-Nachricht empfangen → Notification anzeigen
self.addEventListener('push', (event) => {
    let data = {
        title: 'Abendruhe',
        body: 'Zeit für deine Schlafmeditation 🌙',
        url: './'
    };
    if (event.data) {
        try { data = { ...data, ...event.data.json() }; } catch (e) {}
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            tag: 'abendruhe-reminder',
            data: { url: data.url }
        })
    );
});

// 5) Klick auf die Notification → App öffnen
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || './';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((wins) => {
            for (const w of wins) {
                if (w.url.includes(url) && 'focus' in w) return w.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
