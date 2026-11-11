// Sidequest Board offline support.
// The page itself is fetched fresh when online (so your updates show up right away)
// and served from this cache when you're offline.
const CACHE = "sidequest-v5";
const CORE = ["./", "./index.html", "./firebase-config.js", "./apple-touch-icon.png", "./icon-512.png", "./manifest.json", "./tavern.mp3", "./crow.webp"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function saveCopy(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Live data and sign-in always go straight to Firebase.
  if (/firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken/.test(url.hostname + url.pathname)) return;

  // The intro film streams straight from the network (videos need range requests).
  if (/\.mp4$/i.test(url.pathname) || req.headers.has("range")) return;

  // This site's own files: network first, cache when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => saveCopy(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Fonts and the Firebase library: cache first.
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => saveCopy(req, res))));
  }
});
