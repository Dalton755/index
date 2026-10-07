self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Zelo'
  const scope = self.registration.scope
  const icon = new URL('zelo-icon.svg', scope).href
  const target = new URL(payload.url || './', scope).href

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Você tem uma nova atualização.',
      icon,
      badge: icon,
      tag: payload.tag || payload.notification_id || 'zelo',
      renotify: true,
      data: {
        url: target,
        notification_id: payload.notification_id || null,
        order_id: payload.order_id || null,
        type: payload.type || null,
      },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = event.notification.data?.url || self.registration.scope

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      for (const client of windows) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(target)
          }
          return client.focus()
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined
    }),
  )
})
