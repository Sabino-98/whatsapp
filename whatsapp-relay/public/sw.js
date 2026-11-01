// Service worker mínimo: o Chrome exige um para oferecer a instalação.
// O painel depende do servidor, então não há cache offline.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)))
