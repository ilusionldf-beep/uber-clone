import { supabase } from './supabase'

const VAPID_PUBLIC = 'BG4rUbHabgkxOrBXAjNummYyzx02rvAyy3m3QYhB29HotAjv6lB5VlTAU1E7GvbIGnzfRfvsL3obdy8ywNY24tY'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function registerPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push no soportado en este navegador')
    return false
  }

  try {
    // Registrar Service Worker
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Pedir permiso
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Suscribirse al push
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    })

    // Guardar suscripción en Supabase
    const subData = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id:   userId,
      endpoint:  subData.endpoint,
      p256dh:    subData.keys.p256dh,
      auth:      subData.keys.auth,
    }, { onConflict: 'user_id' })

    console.log('✅ Push notifications activadas')
    return true
  } catch (e) {
    console.error('Error registrando push:', e)
    return false
  }
}

export async function unregisterPush(userId) {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    }
    await supabase.from('push_subscriptions').delete().eq('user_id', userId)
  } catch (e) {
    console.error(e)
  }
}
