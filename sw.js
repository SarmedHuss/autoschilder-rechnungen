// Service Worker: macht die App offline nutzbar. Speichert nur die App-Dateien,
// niemals Rechnungs- oder Kundendaten (die liegen in IndexedDB des Browsers).
const CACHE = "rechnungen-v1";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "vendor/jspdf.umd.min.js",
  "vendor/qrcode.js",
  "icons/icon.svg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // Seite selbst: erst Netz (damit Updates ankommen), sonst Cache.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }
  // Übrige App-Dateien: Cache zuerst, im Hintergrund aktualisieren.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
