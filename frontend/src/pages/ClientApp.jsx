import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import Chat from '../components/Chat'
import RatingModal from '../components/RatingModal'
import RideRequest from '../components/RideRequest'
import { useLang } from '../lib/LangContext'
import LangSwitcher from '../components/LangSwitcher'

const VI_CENTER = [18.3358, -64.8963]

export default function ClientApp() {
  const [user, setUser]       = useState(null)
  const [drivers, setDrivers] = useState([])
  const [history, setHistory] = useState([])
  const [tab, setTab]         = useState('map')
  const [toast, setToast]     = useState('')
  const [requesting, setRequesting] = useState(false)
  const [mapReady, setMapReady]     = useState(false)
  const [activeTrip, setActiveTrip]   = useState(null)
  const [showChat, setShowChat]       = useState(false)
  const [showRating, setShowRating]   = useState(false)
  const [completedTrip, setCompleted] = useState(null)
  const [driverUserId, setDriverUser] = useState(null)
  const mapRef   = useRef(null)
  const mapInst  = useRef(null)
  const markersRef = useRef([])
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
          // Cargar viaje activo si existe
          const { data: trip } = await supabase.from('trips')
            .select('*').eq('client_id', data.id)
            .in('status', ['accepted', 'in_progress'])
            .order('accepted_at', { ascending: false })
            .limit(1).single()
          if (trip) setActiveTrip(trip)
        })
    })
    loadDrivers()

    // Suscripción realtime: conductores disponibles
    const ch1 = supabase.channel('driver-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers' },
        () => loadDrivers())
      .subscribe()

    // Suscripción realtime: mi viaje aceptado
    const ch2 = supabase.channel('my-trip-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' },
        payload => {
          const t = payload.new
          if (t.status === 'accepted') {
            setActiveTrip(t)
            showToast('🚖 ¡Conductor en camino!')
          } else if (t.status === 'completed') {
            setCompleted(t)
            setActiveTrip(null)
            showToast('✅ Viaje completado — ¡gracias!')
            // Obtener user_id del conductor para la calificación
            if (t.driver_id) {
              supabase.from('drivers').select('user_id').eq('id', t.driver_id).single()
                .then(({ data }) => { if (data) setDriverUser(data.user_id) })
            }
            setTimeout(() => setShowRating(true), 1000)
          } else if (t.status === 'cancelled') {
            setActiveTrip(null)
            showToast('❌ Viaje cancelado')
          }
        })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
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
      const { data } = await supabase.from('available_drivers').select('*')
      setDrivers(data || [])
    } catch { setDrivers([]) }
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
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
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

  async function requestRide({ origin, dest, fare }) {
    if (!user) return
    setRequesting(true)
    try {
      const { error } = await supabase.rpc('request_trip', {
        p_client_id:   user.id,
        p_origin_addr: origin.name,
        p_origin_lat:  origin.lat,
        p_origin_lng:  origin.lng,
        p_dest_addr:   dest.name,
        p_dest_lat:    dest.lat,
        p_dest_lng:    dest.lng,
        p_notes:       `fare:${fare.total}`
      })
      if (error) throw error
      showToast(`✅ Viaje solicitado · ${fare.totalStr}`)
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
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <div>
          <div className="font-black text-yellow-400 text-lg">🚖 Uber Clone</div>
          <div className="text-xs text-gray-500">{user?.full_name || t('clientTitle')}</div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 transition px-3 py-1 border border-zinc-700 rounded-lg">
            {t('logout')}
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
            <button onClick={() => setShowChat(true)}
              className="w-full bg-green-400 hover:bg-green-300 text-black font-bold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2">
              {t('chatDriver')}
            </button>
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
            <div ref={mapRef} style={{ height: 260, borderRadius: 12, overflow: 'hidden', background: '#18181b' }}>
              {!mapReady && (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">{t('loadingMap')}</div>
              )}
            </div>

            {/* Solicitar viaje con tarifa */}
            {activeTrip ? (
              <button disabled
                className="w-full bg-yellow-400/40 text-black font-bold py-4 rounded-xl text-base opacity-60 cursor-not-allowed">
                {t('driverOnWayBtn')}
              </button>
            ) : (
              <RideRequest
                onRequest={requestRide}
                requesting={requesting}
              />
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

      {/* Chat */}
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
