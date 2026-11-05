// Service worker. На iPadOS 18.4+ уведомления показывает сама система (Declarative Web Push),
// этот код — запасной путь для более старых версий.
export const SW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let n = { title: 'MY OS', body: 'Новое уведомление MY OS', navigate: '/' };
  try { const d = event.data && event.data.json(); if (d && d.notification) n = { ...n, ...d.notification }; } catch (e) {}
  event.waitUntil(self.registration.showNotification(n.title, { body: n.body, lang: 'ru', icon: '/icon.png', data: { navigate: n.navigate } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.navigate) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('navigate' in c) { await c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  })());
});
`;
