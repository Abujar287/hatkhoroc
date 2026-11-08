// Service Worker for হাত খরচ (Task Reminders & Notifications)
const CACHE_NAME = 'hat-khoroch-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (k !== CACHE_NAME) return caches.delete(k);
          })
        )
      )
    ])
  );
});

// Handle incoming messages from page to trigger notification even in background
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notificationOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [500, 200, 500, 200, 500, 200, 800],
      requireInteraction: true,
      renotify: true,
      tag: options?.tag || 'task-alarm',
      data: { url: '/?tab=task', ...options?.data },
      ...options
    };
    self.registration.showNotification(title, notificationOptions);
  }
});

// Handle incoming Web Push notifications (Wakes up mobile device even when app is closed)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: '🚨 বকেয়া বিল/টাস্ক অ্যালার্ম',
        body: event.data.text()
      };
    }
  }

  const title = data.title || '🚨 বকেয়া বিল/টাস্ক অ্যালার্ম';
  const targetUrl = data.url || '/?tab=task';

  const notificationOptions = {
    body: data.body || 'আপনার আজকের বকেয়া বিল বা টাস্ক পরিশোধের নির্ধারিত সময় হয়েছে।',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [800, 300, 800, 300, 800, 300, 1200],
    sound: '/alarm.wav',
    requireInteraction: true,
    renotify: true,
    tag: data.tag || `task-alarm-${Date.now()}`,
    data: {
      url: targetUrl,
      taskId: data.taskId,
      ...data
    },
    actions: [
      { action: 'open_task', title: 'Open & View Task' }
    ]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, notificationOptions),
      // Broadcast to any active client tabs to start ringing immediately
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'TASK_ALARM_PUSH_RECEIVED',
            taskId: data.taskId
          });
        });
      })
    ])
  );
});

// Handle clicking on notification in phone notification bar
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/?tab=task';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client && client.url.indexOf(targetUrl) === -1) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
