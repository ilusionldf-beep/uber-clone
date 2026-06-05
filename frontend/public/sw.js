// ============================================================
//  Uber Clone — Service Worker
//  Maneja notificaciones push cuando la app está cerrada
// ============================================================

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// Recibir notificación push del servidor
self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()

  const options = {
    body:    data.body  || '...',
    icon:    data.icon  || '/favicon.svg',
    badge:   data.badge || '/favicon.svg',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/' },
    actions: data.actions || [],
  }

  e.waitUntil(
    self.registration.showNotification(data.title || 'Uber Clone', options)
  )
})

// Click en la notificación → abrir la app
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Si la app ya está abierta, enfócala
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Si no, abre una nueva ventana
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
