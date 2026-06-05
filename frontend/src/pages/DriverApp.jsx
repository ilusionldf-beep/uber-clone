import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Chat from '../components/Chat'
import { useLang } from '../lib/LangContext'
import LangSwitcher from '../components/LangSwitcher'
import { calcFare, calcDistance } from '../lib/fare'

const VI_CENTER = [18.3388, -64.9103]

export default function DriverApp() {
  const [user, setUser]           = useState(null)
  const [driver, setDriver]       = useState(null)
  const [isOnline, setIsOnline]   = useState(false)
  const [pendingTrip, setPending] = useState(null)
  const [mapReady, setMapReady]   = useState(false)
  const [toast, setToast]         = useState('')
  const [activeTrip, setActiveTrip] = useState(null)
  const [showChat, setShowChat]     = useState(false)
  const [completing, setCompleting] = useState(false)
  const [tripFare, setTripFare]     = useState(null)
  const mapRef    = useRef(null)
  const mapInst   = useRef(null)
  const myMarker  = useRef(null)
  const gpsTimer  = useRef(null)
  const navigate  = useNavigate()
  const { t } = useLang()

  // Auth + datos
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { navigate('/'); return }
      supabase.from('users').select('*').eq('auth_id', u.id).single()
        .then(({ data }) => {
          if (data) {
            setUser(data)
            loadDriver(data.id)
          }
        })
    })

    // Escuchar nuevas solicitudes de viaje en tiempo real
    const ch = supabase.channel('trip-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' },
        payload => {
          if (payload.new.status === 'requested') {
            setPending(payload.new)
            showToast('🔔 Nueva solicitud de viaje!')
          }
        })
      .subscribe()

    setTimeout(initMap, 200)
    return () => {
      supabase.removeChannel(ch)
      if (gpsTimer.current) clearInterval(gpsTimer.current)
    }
  }, [])

  async function loadDriver(userId) {
    try {
      const { data } = await supabase.from('drivers').select('*').eq('user_id', userId).single()
      if (data) {
        setDriver(data)
        setIsOnline(data.is_online)
        // Cargar viaje activo si existe
        const { data: trip } = await supabase.from('trips')
          .select('*').eq('driver_id', data.id)
          .in('status', ['accepted', 'in_progress'])
          .order('accepted_at', { ascending: false })
          .limit(1).single()
        if (trip) setActiveTrip(trip)
      }
    } catch { /* no driver profile yet */ }
  }

  async function initMap() {
    if (!mapRef.current) return
    try {
      const { default: L } = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      if (mapRef.current._leaflet_id) {
        mapInst.current?.remove()
        mapInst.current = null
      }
      if (mapInst.current) return

      mapInst.current = L.map(mapRef.current, { center: VI_CENTER, zoom: 14 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapInst.current)

      myMarker.current = L.marker(VI_CENTER, {
        icon: L.divIcon({
          className: '',
          html: '<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🚖</div>',
          iconSize: [32, 32], iconAnchor: [16, 16]
        })
      }).addTo(mapInst.current).bindPopup('📍 Tu posición')

      setMapReady(true)
    } catch (e) {
      console.error('Map init error:', e)
    }
  }

  async function toggleOnline() {
    if (!driver) {
      showToast('⚠️ Tu perfil de conductor aún no está configurado')
      return
    }
    const next = !isOnline
    setIsOnline(next)
    await supabase.from('drivers').update({
      is_online: next,
      status: next ? 'available' : 'offline'
    }).eq('id', driver.id)

    if (next) startGPS()
    else stopGPS()
    showToast(next ? '🟢 Estás en línea — aceptando viajes' : '⚫ Desconectado')
  }

  function startGPS() {
    if (!navigator.geolocation) {
      showToast('⚠️ GPS no disponible en este navegador')
      return
    }
    gpsTimer.current = setInterval(async () => {
      navigator.geolocation.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lng } = pos.coords

        // Mover marker en el mapa
        if (myMarker.current) myMarker.current.setLatLng([lat, lng])
        if (mapInst.current) mapInst.current.panTo([lat, lng])

        // Enviar GPS a Supabase
        if (driver) {
          await supabase.rpc('update_driver_location', {
            p_driver_id: driver.id,
            p_lat: lat, p_lng: lng,
            p_speed: null, p_heading: null, p_trip_id: null
          }).catch(() => {})
        }
      }, () => {})
    }, 5000)
  }

  function stopGPS() {
    if (gpsTimer.current) {
      clearInterval(gpsTimer.current)
      gpsTimer.current = null
    }
  }

  async function acceptTrip() {
    if (!driver || !pendingTrip) return
    const { data, error } = await supabase.rpc('accept_trip', {
      p_trip_id: pendingTrip.id,
      p_driver_id: driver.id
    })
    if (error || !data) {
      showToast('❌ Viaje ya tomado por otro conductor')
    } else {
      setActiveTrip(pendingTrip)
      // Calcular tarifa del viaje aceptado
      const dist = calcDistance(
        pendingTrip.origin_lat, pendingTrip.origin_lng,
        pendingTrip.dest_lat,   pendingTrip.dest_lng
      )
      setTripFare(calcFare(dist))
      showToast('✅ Viaje aceptado — en camino al cliente')
    }
    setPending(null)
  }

  async function completeTrip() {
    if (!activeTrip || !driver) return
    setCompleting(true)
    // Calcular distancia aproximada entre origen y destino
    const dist = calcDistance(
      activeTrip.origin_lat, activeTrip.origin_lng,
      activeTrip.dest_lat,   activeTrip.dest_lng
    )
    const { data, error } = await supabase.rpc('complete_trip', {
      p_trip_id:      activeTrip.id,
      p_distance_km:  dist,
      p_duration_min: Math.round(dist * 3)  // aprox 3 min/km
    })
    setCompleting(false)
    if (error) { showToast('❌ ' + error.message); return }
    setActiveTrip(null)
    setTripFare(null)
    showToast('✅ Viaje completado — ¡excelente trabajo!')
  }

  function calcDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lat2) return 0
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2
    return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function logout() {
    stopGPS()
    if (driver) {
      await supabase.from('drivers').update({ is_online: false, status: 'offline' }).eq('id', driver.id)
    }
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto relative">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-yellow-400/20 flex-shrink-0">
        <div>
          <div className="font-black text-yellow-400 text-lg">🚖 {t('driverTitle')}</div>
          <div className="text-xs text-gray-500">{user?.full_name || '...'}</div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <button onClick={() => navigate('/profile')}
            className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-bold text-xs hover:bg-yellow-400/20 transition">
            {user?.full_name?.slice(0,1).toUpperCase() || '?'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Toggle Online/Offline */}
        <button onClick={toggleOnline}
          className={`w-full py-4 rounded-xl font-bold text-sm transition border-2 ${
            isOnline
              ? 'bg-green-400/10 border-green-400 text-green-400 hover:bg-green-400/20'
              : 'bg-zinc-900 border-zinc-700 text-gray-400 hover:border-yellow-400 hover:text-yellow-400'
          }`}>
          <div className="text-lg mb-0.5">{isOnline ? '🟢' : '⚫'}</div>
          {isOnline ? t('online') : t('offline')}
        </button>

        {/* Solicitud pendiente */}
        {pendingTrip && (
          <div className="bg-yellow-400/10 border-2 border-yellow-400 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-400 font-bold text-xs tracking-wider">{t('newRequest')}</span>
            </div>
            <div className="space-y-1.5 mb-4 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">📍</span>
                <span className="text-gray-200">{pendingTrip.origin_address}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">🏁</span>
                <span className="text-gray-200">{pendingTrip.dest_address}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={acceptTrip}
                className="bg-green-400 hover:bg-green-300 active:scale-95 text-black font-bold py-3 rounded-lg text-sm transition">
                {t('accept')}
              </button>
              <button onClick={() => setPending(null)}
                className="border border-red-400 text-red-400 hover:bg-red-400/10 active:scale-95 font-bold py-3 rounded-lg text-sm transition">
                {t('reject')}
              </button>
            </div>
          </div>
        )}

        {/* Controles de viaje activo */}
        {activeTrip && (
          <div className="space-y-2">
            <div className="bg-zinc-900 border border-yellow-400/30 rounded-xl p-3">
              <div className="text-xs text-gray-400 text-center mb-2">
                {t('tripInProgress')} · {activeTrip.origin_address} → {activeTrip.dest_address}
              </div>
              {tripFare && (
                <div className="flex items-center justify-between text-xs border-t border-zinc-800 pt-2 mt-1">
                  <span className="text-gray-500">{tripFare.distanceKm} km · {tripFare.durationMin} min</span>
                  <span className="font-black text-lg text-yellow-400">{tripFare.totalStr}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowChat(true)}
                className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-1">
                {t('chatPassenger')}
              </button>
              <button onClick={completeTrip} disabled={completing}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-1">
                {completing ? t('completing') : t('completeTrip')}
              </button>
            </div>
          </div>
        )}

        {/* Mapa */}
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
            {isOnline ? t('gpsActive') : t('myZone')}
          </div>
          <div ref={mapRef} style={{ height: 260, borderRadius: 12, overflow: 'hidden', background: '#18181b' }}>
            {!mapReady && (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm">{t('loadingMap')}</div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
            <div className="text-xl font-bold text-yellow-400">
              ${parseFloat(driver?.total_earnings || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{t('totalEarnings')}</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
            <div className="text-xl font-bold text-yellow-400">
              {user?.rating_avg ?? 5.0} ⭐
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{t('statRating')}</div>
          </div>
        </div>

        {/* Info perfil conductor */}
        {driver ? (
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">{t('myVehicle')}</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('plate')}</span>
              <span className="font-mono text-yellow-400">{driver.license_plate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{t('model')}</span>
              <span>{driver.vehicle_model || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Estado</span>
              <span className={driver.status === 'available' ? 'text-green-400' : 'text-gray-400'}>
                {driver.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-400/20 text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-sm text-yellow-400 font-medium">Perfil de conductor incompleto</div>
            <div className="text-xs text-gray-500 mt-1">Necesitas agregar tu vehículo en Supabase</div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white text-sm px-5 py-3 rounded-full shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Chat */}
      {showChat && activeTrip && user && (
        <Chat
          tripId={activeTrip.id}
          senderId={user.id}
          senderName={user.full_name}
          otherName="Pasajero"
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}
