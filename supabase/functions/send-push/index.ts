import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const VAPID_PUBLIC  = 'BG4rUbHabgkxOrBXAjNummYyzx02rvAyy3m3QYhB29HotAjv6lB5VlTAU1E7GvbIGnzfRfvsL3obdy8ywNY24tY'
const VAPID_PRIVATE = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgF-KKGcjxPSiVagNo2LhTVGnmzfvnGMJ8E3WbWFtxC8KhRANCAARuK1Gx2m4JMTqwVwIzbppmMs8dNq7wMst5t0GIQdvR6LQI7-pQeVZUwFNROxr2yBp830X77C96G3cvMsDWNuLW'

webpush.setVapidDetails(
  'mailto:ilusion.ldf@gmail.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const { user_id, title, body, url } = await req.json()

  // Obtener suscripción del usuario
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .single()

  if (!sub) return new Response(JSON.stringify({ error: 'No subscription' }), { status: 404 })

  const payload = JSON.stringify({ title, body, url: url || '/', icon: '/favicon.svg' })

  try {
    await webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    }, payload)
    return new Response(JSON.stringify({ sent: true }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
