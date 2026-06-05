import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Chat from '../components/Chat'
import DirectChat from '../components/DirectChat'
import RatingModal from '../components/RatingModal'
import { useLang } from '../lib/LangContext'
import LangSwitcher from '../components/LangSwitcher'
import { registerPush } from '../lib/pushNotifications'
import ShareButton from '../components/ShareButton'

const VI_CENTER = [18.3358, -64.8963]

export default function ClientApp() {
  const [user, setUser]       = useState(null)
  const [drivers, setDrivers]         = useState([])
  const [allDrivers, setAllDrivers]   = useState([])
  const [history, setHistory]         = useState([])
  const [chatDriver, setChatDriver]   = useState(null)
  const [tab, setTab]         = useState('map')
  const [toast, setToast]     = useState('')
  const [requesting, setRequesting] = useState(false)
  const [mapReady, setMapReady]     = useState(false)
  const [isSat, setIsSat]           = useState(false)
  const [activeTrip, setActiveTrip]   = useState(null)
  const [showChat, setShowChat]       = useState(false)
  const [showRating, setShowRating]   = useState(false)
  const [cancelling, setCancelling]   = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [completedTrip, setCompleted] = useState(null)
  const [driverUserId, setDriverUser] = useState(null)
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const markersRef = useRef([])
  const tileRef    = useRef(null)
  const routeRef   = useRef(null)
  const driverMkr  = useRef(null)
  const navigate = useNavigate()
  const { t } = useLang()

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { navigate('/'); return }
      supabase.from('users').select('*').eq('auth_id', u.id).single()
        .then(async ({ data }) => {
          if (!data) return
          setUser(data)
          registerPush(data.id)

          // Cargar viaje activo si existe
          const { data: trip } = await supabase.from('trips')
            .select('*').eq('client_id', data.id)
            .in('status', ['accepted','in_progress','requested'])
            .order('requested_at', { ascending: false })
            .limit(1).single()
          if (trip) {
            setActiveTrip(trip)
            if (trip.status === 'accepted' || trip.status === 'in_progress') {
              drawRoute(trip.origin_lat, trip.origin_lng, trip.dest_lat, trip.dest_lng, null, null)
            }
          }

          // Suscripción a viajes del cliente con filtro por client_id
          supabase.channel(`client-trips-${data.id}`)
            .on('postgres_changes', {
              event: 'UPDATE', schema: 'public', table: 'trips',
              filter: `client_id=eq.${data.id}`
            }, payload => {
              const t = payload.new
              if (t.status === 'accepted') {
                setActiveTrip(t)
                showToast('🚖 ¡Conductor en camino!')
                drawRoute(t.origin_lat, t.origin_lng, t.dest_lat, t.dest_lng, null, null)
              } else if (t.status === 'completed') {
                setCompleted(t)
                setActiveTrip(null)
                showToast('✅ Viaje completado — ¡gracias!')
                if (t.driver_id) {
                  supabase.from('drivers').select('user_id').eq('id', t.driver_id).single()
                    .then(({ data: dData }) => {
                      if (dData) {
                        setDriverUser(dData.user_id)
                        setTimeout(() => setShowRating(true), 800)
                      }
                    })
                }
              } else if (t.status === 'cancelled') {
                setActiveTrip(null)
                showToast('❌ Viaje cancelado por el conductor')
              }
            })
            .subscribe()
        })
    })
    loadDrivers()

    // Suscripción realtime: conductores disponibles + GPS en tiempo real
    const ch1 = supabase.channel('driver-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers' },
        async (payload) => {
          loadDrivers()
          // Actualizar posición del conductor en el mapa si hay viaje activo
          const d = payload.new
          if (d.current_lat && d.current_lng && driverMkr.current) {
            const { default: L } = await import('leaflet').catch(() => ({ default: null }))
            if (L) driverMkr.current.setLatLng([d.current_lat, d.current_lng])
          }
        })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
    }
  }, [])

  // Iniciar mapa cuando la tab sea 'map'
  useEffect(() => {
    if (tab === 'map') {
      setTimeout(initMap, 150)
    }
    if (tab === 'history') loadHistory()
  }, [tab])

  // Actualizar markers cuando cambien los conductores
  useEffect(() => {
    if (!mapInst.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    drivers.forEach(d => {
      if (!d.current_lat || !d.current_lng) return
      import('leaflet').then(({ default: L }) => {
        const m = L.marker([d.current_lat, d.current_lng], {
          icon: L.divIcon({
            className: '',
            html: '<div style="font-size:22px">🚖</div>',
            iconSize: [28, 28], iconAnchor: [14, 14]
          })
        }).addTo(mapInst.current)
          .bindPopup(`<b>${d.full_name}</b><br>${d.license_plate}<br>⭐ ${d.rating_avg}`)
        markersRef.current.push(m)
      })
    })
  }, [drivers, mapReady])

  async function loadDrivers() {
    try {
      // Conductores disponibles
      const { data: avail } = await supabase.from('available_drivers').select('*')
      setDrivers(avail || [])
      // Todos los conductores (disponibles + ocupados + offline)
      const { data: all } = await supabase.from('drivers')
        .select('*, users(full_name, rating_avg, total_trips, avatar_url)')
        .order('is_online', { ascending: false })
      setAllDrivers(all || [])
    } catch { setDrivers([]); setAllDrivers([]) }
  }

  async function loadHistory() {
    if (!user) return
    try {
      const { data } = await supabase.from('trips')
        .select('*, drivers(license_plate, users(full_name))')
        .eq('client_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(10)
      setHistory(data || [])
    } catch { setHistory([]) }
  }

  async function initMap() {
    if (!mapRef.current) return
    try {
      const { default: L } = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      // Destruir mapa previo si existe (hot-reload)
      if (mapRef.current._leaflet_id) {
        mapInst.current?.remove()
        mapInst.current = null
      }
      if (mapInst.current) return

      mapInst.current = L.map(mapRef.current, { center: VI_CENTER, zoom: 13 })
      tileRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
      }).addTo(mapInst.current)

      L.marker(VI_CENTER, {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#facc15;border:3px solid white;box-shadow:0 0 10px #facc1588"></div>',
          iconSize: [14, 14], iconAnchor: [7, 7]
        })
      }).addTo(mapInst.current).bindPopup('📍 Tu posición')

      setMapReady(true)
    } catch (e) {
      console.error('Map error:', e)
    }
  }

  function locateMe() {
    if (!navigator.geolocation || !mapInst.current) return
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      mapInst.current.flyTo([lat, lng], 16, { animate: true, duration: 1.2 })
      if (myClientMarker) myClientMarker.setLatLng([lat, lng])
    }, () => showToast('⚠️ No se pudo obtener tu ubicación'))
  }

  async function toggleSat() {
    if (!mapInst.current || !tileRef.current) return
    const { default: L } = await import('leaflet')
    mapInst.current.removeLayer(tileRef.current)
    if (!isSat) {
      tileRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© ESRI', maxZoom: 19 }
      ).addTo(mapInst.current)
      setIsSat(true)
    } else {
      tileRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap', maxZoom: 19 }
      ).addTo(mapInst.current)
      setIsSat(false)
    }
  }

  async function drawRoute(originLat, originLng, destLat, destLng, driverLat, driverLng) {
    if (!mapInst.current) return
    const { default: L } = await import('leaflet')

    // Borrar ruta anterior
    if (routeRef.current) { mapInst.current.removeLayer(routeRef.current) }
    if (driverMkr.current) { mapInst.current.removeLayer(driverMkr.current) }

    const points = [[originLat, originLng], [destLat, destLng]]

    // Línea de ruta
    routeRef.current = L.polyline(points, {
      color: '#facc15', weight: 4, opacity: 0.8,
      dashArray: '8, 6'
    }).addTo(mapInst.current)

    // Marker del conductor si tiene posición
    if (driverLat && driverLng) {
      driverMkr.current = L.marker([driverLat, driverLng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🚖</div>',
          iconSize: [30, 30], iconAnchor: [15, 15]
        })
      }).addTo(mapInst.current).bindPopup('🚖 Tu conductor')
    }

    // Zoom para mostrar toda la ruta
    mapInst.current.fitBounds(L.latLngBounds(points).pad(0.3))
  }

  async function cancelRide() {
    if (!activeTrip) return
    setCancelling(true)
    const { error } = await supabase.from('trips')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: 'Cancelado por el cliente' })
      .eq('id', activeTrip.id)
    setCancelling(false)
    if (error) { showToast('❌ ' + error.message); return }
    setActiveTrip(null)
    if (routeRef.current && mapInst.current) mapInst.current.removeLayer(routeRef.current)
    showToast('🚫 Viaje cancelado')
  }

  async function requestRide() {
    if (!user) return
    setRequesting(true)
    try {
      const { error } = await supabase.rpc('request_trip', {
        p_client_id:   user.id,
        p_origin_addr: 'Charlotte Amalie',
        p_origin_lat:  18.3358, p_origin_lng: -64.8963,
        p_dest_addr:   'Aeropuerto Cyril E. King',
        p_dest_lat:    18.3373, p_dest_lng:  -64.9733,
        p_notes:       null
      })
      if (error) throw error
      showToast('✅ Viaje solicitado — esperando conductor...')
    } catch (e) {
      showToast('❌ ' + e.message)
    } finally {
      setRequesting(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen text-white flex flex-col max-w-md mx-auto relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <div>
          <div className="font-black text-yellow-400 text-lg">🚖 Taxi Virgin Islands</div>
          <div className="text-xs text-gray-500">{user?.full_name || t('clientTitle')}</div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <button onClick={() => navigate('/profile')}
            className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-bold text-xs hover:bg-yellow-400/20 transition">
            {user?.full_name?.slice(0,1).toUpperCase() || '?'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 flex-shrink-0">
        {[['map', t('tabMap')], ['drivers', t('tabDrivers')], ['history', t('tabHistory')]].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 text-xs font-semibold transition ${tab === k ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">

        {/* ── VIAJE EN CURSO BANNER ── */}
        {activeTrip && (
          <div className="mx-4 mt-4 bg-green-400/10 border-2 border-green-400 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 font-bold text-xs tracking-wider">{t('driverOnWay')}</span>
            </div>
            <div className="text-sm space-y-1 mb-3">
              <div>📍 <span className="text-gray-300">{activeTrip.origin_address}</span></div>
              <div>🏁 <span className="text-gray-300">{activeTrip.dest_address}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowChat(true)}
                className="bg-green-400 hover:bg-green-300 active:scale-95 text-black font-bold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-1">
                💬 Chat
              </button>
              <button onClick={cancelRide} disabled={cancelling}
                className="bg-red-500/10 hover:bg-red-500/20 active:scale-95 border border-red-400/50 text-red-400 font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50">
                {cancelling ? '⏳' : '✕ Cancelar'}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB MAPA ── */}
        {tab === 'map' && (
          <div className="p-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('statAvailable'), val: drivers.length, color: 'text-green-400' },
                { label: t('statRating'), val: `${user?.rating_avg ?? 5.0}⭐`, color: 'text-yellow-400' },
                { label: t('statTrips'), val: user?.total_trips ?? 0, color: 'text-blue-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-zinc-900 rounded-xl p-3 text-center border border-zinc-800">
                  <div className={`text-base font-bold ${color}`}>{val}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Mapa */}
            <div className="relative">
              <div ref={mapRef} style={{ height: 260, borderRadius: 12, overflow: 'hidden', background: '#18181b' }}>
                {!mapReady && (
                  <div className="h-full flex items-center justify-center text-gray-600 text-sm">{t('loadingMap')}</div>
                )}
              </div>
              {mapReady && (
                <>
                  <button onClick={toggleSat}
                    className={`absolute top-2 right-2 z-[1000] px-2 py-1 rounded-lg text-xs font-bold border transition ${
                      isSat
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-zinc-900/90 text-white border-zinc-600 hover:border-yellow-400'
                    }`}>
                    {isSat ? '🗺 Mapa' : '🛰 Satélite'}
                  </button>
                  <button onClick={locateMe}
                    className="absolute top-2 left-2 z-[1000] px-2 py-1 rounded-lg text-xs font-bold border bg-zinc-900/90 text-yellow-400 border-yellow-400/50 hover:border-yellow-400 transition">
                    📍 Yo
                  </button>
                </>
              )}
            </div>

            {/* Botón solicitar viaje */}
            <button onClick={requestRide} disabled={requesting || !!activeTrip}
              className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-bold py-4 rounded-xl text-base transition disabled:opacity-50">
              {activeTrip ? t('driverOnWayBtn') : requesting ? t('requestingBtn') : t('requestBtn')}
            </button>

            {/* Lista de conductores en el mapa */}
            {allDrivers.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium pt-1">
                  🚕 Conductores ({allDrivers.length})
                </div>
                {allDrivers.map(d => {
                  const isAvail = d.status === 'available' && d.is_online
                  const isBusy  = d.status === 'busy'
                  return (
                    <div key={d.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                        isAvail ? 'bg-zinc-900 border-green-400/20 hover:border-green-400/40' :
                        isBusy  ? 'bg-zinc-900 border-zinc-700 opacity-70' :
                                  'bg-zinc-900/50 border-zinc-800 opacity-50'
                      }`}>

                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {d.users?.avatar_url ? (
                          <img src={d.users.avatar_url} className="w-10 h-10 rounded-full border-2 border-zinc-700" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                            isAvail ? 'bg-green-400/10 border-green-400/40 text-green-400' :
                            isBusy  ? 'bg-orange-400/10 border-orange-400/40 text-orange-400' :
                                      'bg-zinc-700/30 border-zinc-600 text-zinc-500'
                          }`}>
                            {d.users?.full_name?.slice(0,2).toUpperCase() || '??'}
                          </div>
                        )}
                        {/* Dot de estado */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${
                          isAvail ? 'bg-green-400' : isBusy ? 'bg-orange-400' : 'bg-zinc-600'
                        }`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {d.users?.full_name || 'Conductor'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-yellow-400">⭐ {d.users?.rating_avg || 5.0}</span>
                          <span className="text-xs text-gray-500">·</span>
                          <span className={`text-xs font-medium ${
                            isAvail ? 'text-green-400' : isBusy ? 'text-orange-400' : 'text-zinc-500'
                          }`}>
                            {isAvail ? '🟢 Disponible' : isBusy ? '🟠 Ocupado' : '⚫ Sin conexión'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5 font-mono">{d.license_plate}</div>
                      </div>

                      {/* Botón chat solo si disponible */}
                      {isAvail && user && (
                        <button
                          onClick={() => setChatDriver({ ...d, user_id: d.users?.id || d.user_id })}
                          className="flex-shrink-0 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black text-xs font-bold px-3 py-2 rounded-lg transition">
                          💬 Chat
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONDUCTORES ── */}
        {tab === 'drivers' && (
          <div className="p-4 space-y-3">
            {drivers.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🚕</div>
                <div className="text-gray-500 text-sm">{t('noDrivers')}</div>
              </div>
            ) : drivers.map(d => (
              <div key={d.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-bold text-sm flex-shrink-0">
                  {d.full_name?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{d.full_name}</div>
                  <div className="text-xs text-gray-500">{d.license_plate} · {d.vehicle_model || 'Vehículo'}</div>
                  <div className="text-xs text-yellow-400 mt-0.5">⭐ {d.rating_avg} · {d.total_trips} viajes</div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* ── TAB HISTORIAL ── */}
        {tab === 'history' && (
          <div className="p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-gray-500 text-sm">{t('noHistory')}</div>
              </div>
            ) : history.map(t => (
              <div key={t.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.status === 'completed' ? 'bg-green-400/10 text-green-400' :
                    t.status === 'cancelled' ? 'bg-red-400/10 text-red-400' :
                    'bg-yellow-400/10 text-yellow-400'}`}>
                    {t.status}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(t.requested_at).toLocaleDateString()}</span>
                </div>
                <div className="text-sm font-medium">{t.origin_address}</div>
                <div className="text-xs text-gray-500 mt-0.5">→ {t.dest_address}</div>
                {t.drivers && (
                  <div className="text-xs text-gray-400 mt-1">Conductor: {t.drivers.users?.full_name}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white text-sm px-5 py-3 rounded-full shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Rating Modal */}
      {showRating && completedTrip && user && driverUserId && (
        <RatingModal
          trip={completedTrip}
          raterId={user.id}
          ratedId={driverUserId}
          onClose={() => { setShowRating(false); setCompleted(null) }}
        />
      )}

      <ShareButton />

      {/* Chat directo con conductor disponible */}
      {chatDriver && user && (
        <DirectChat
          senderId={user.id}
          senderName={user.full_name}
          receiverId={chatDriver.user_id}
          receiverName={chatDriver.users?.full_name || 'Conductor'}
          receiverAvatar={chatDriver.users?.avatar_url}
          onClose={() => setChatDriver(null)}
        />
      )}

      {/* Chat del viaje activo */}
      {showChat && activeTrip && user && (
        <Chat
          tripId={activeTrip.id}
          senderId={user.id}
          senderName={user.full_name}
          otherName="Conductor"
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}
