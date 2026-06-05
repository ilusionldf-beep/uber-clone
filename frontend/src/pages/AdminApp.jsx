import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import LangSwitcher from '../components/LangSwitcher'
import ShareButton from '../components/ShareButton'

export default function AdminApp() {
  const [tab, setTab]         = useState('overview')
  const [stats, setStats]     = useState({ users:0, drivers:0, trips:0, online:0, earnings:0, ratings:0 })
  const [users, setUsers]     = useState([])
  const [drivers, setDrivers] = useState([])
  const [trips, setTrips]     = useState([])
  const [ratings, setRatings] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)   // { type, id, name }
  const [toast, setToast]     = useState('')
  const [mapReady, setMapReady] = useState(false)
  const mapRef  = useRef(null)
  const mapInst = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadAll()
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' },   loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },   loadAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => {
    if (tab === 'map') setTimeout(initMap, 200)
  }, [tab, drivers])

  async function loadAll() {
    setLoading(true)
    try {
      const [uR, dR, tR, rR, oR] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*, users(full_name, email, rating_avg, total_trips, avatar_url, phone)').order('created_at', { ascending: false }),
        supabase.from('trips').select('*, users!trips_client_id_fkey(full_name, avatar_url)').order('requested_at', { ascending: false }).limit(50),
        supabase.from('ratings').select('*, users!ratings_rated_by_fkey(full_name)').order('created_at', { ascending: false }).limit(30),
        supabase.from('drivers').select('id').eq('is_online', true),
      ])
      const u = uR.data || []; const d = dR.data || []
      const t = tR.data || []; const r = rR.data || []
      const o = oR.data || []
      setUsers(u); setDrivers(d); setTrips(t); setRatings(r)
      const totalEarn = d.reduce((s, x) => s + parseFloat(x.total_earnings||0), 0)
      setStats({ users: u.length, drivers: d.length, trips: t.length, online: o.length, earnings: totalEarn.toFixed(2), ratings: r.length })
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  async function initMap() {
    if (!mapRef.current) return
    try {
      const { default: L } = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      if (mapRef.current._leaflet_id) { mapInst.current?.remove(); mapInst.current = null }
      if (mapInst.current) return
      mapInst.current = L.map(mapRef.current, { center: [18.3358, -64.8963], zoom: 12 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(mapInst.current)
      // Marcadores de conductores
      drivers.forEach(d => {
        if (!d.current_lat || !d.current_lng) return
        const color = d.status === 'available' ? '#4ade80' : d.status === 'busy' ? '#fb923c' : '#71717a'
        L.marker([d.current_lat, d.current_lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${color}22;border:2px solid ${color};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 8px ${color}88">🚖</div>`,
            iconSize: [32,32], iconAnchor: [16,16]
          })
        }).addTo(mapInst.current)
          .bindPopup(`<b>${d.users?.full_name}</b><br>${d.license_plate}<br><span style="color:${color}">${d.status}</span>`)
      })
      setMapReady(true)
    } catch(e) { console.error(e) }
  }

  async function deleteUser(userId, authId, name) {
    try {
      // Borrar datos relacionados
      await supabase.from('ratings').delete().eq('rated_by', userId)
      await supabase.from('messages').delete().eq('sender_id', userId)
      const { data: drv } = await supabase.from('drivers').select('id').eq('user_id', userId).single()
      if (drv) {
        await supabase.from('trips').delete().eq('driver_id', drv.id)
        await supabase.from('drivers').delete().eq('id', drv.id)
      }
      await supabase.from('trips').delete().eq('client_id', userId)
      await supabase.from('users').delete().eq('id', userId)
      // Borrar del auth
      await fetch(`https://munywxejlectjxufjcxb.supabase.co/auth/v1/admin/users/${authId}`, {
        method: 'DELETE',
        headers: {
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bnl3eGVqbGVjdGp4dWZqY3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU5NzY2OCwiZXhwIjoyMDk2MTczNjY4fQ.EZD-CqY0Gq6QCNgP3680MEEupRFA4Zr1KVKSNSBQDNo',
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bnl3eGVqbGVjdGp4dWZqY3hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU5NzY2OCwiZXhwIjoyMDk2MTczNjY4fQ.EZD-CqY0Gq6QCNgP3680MEEupRFA4Zr1KVKSNSBQDNo'
        }
      })
      showToast(`✅ ${name} eliminado`)
      setConfirm(null)
      loadAll()
    } catch(e) { showToast('❌ ' + e.message) }
  }

  async function toggleDriverOnline(driverId, current) {
    await supabase.from('drivers').update({ is_online: !current, status: !current ? 'available' : 'offline' }).eq('id', driverId)
    showToast(current ? '⚫ Conductor desconectado' : '🟢 Conductor conectado')
    loadAll()
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const completed = trips.filter(t => t.status === 'completed').length
  const cancelled = trips.filter(t => t.status === 'cancelled').length
  const active    = trips.filter(t => ['accepted','in_progress'].includes(t.status)).length
  const avgRating = ratings.length ? (ratings.reduce((s,r) => s + r.stars, 0) / ratings.length).toFixed(1) : '—'
  const topDriver = drivers.sort((a,b) => parseFloat(b.total_earnings||0) - parseFloat(a.total_earnings||0))[0]

  const statusColor = s => ({ completed:'bg-green-400/10 text-green-400', requested:'bg-yellow-400/10 text-yellow-400', accepted:'bg-blue-400/10 text-blue-400', in_progress:'bg-blue-400/10 text-blue-400', cancelled:'bg-red-400/10 text-red-400' })[s] || 'bg-zinc-700 text-gray-400'

  const tabs = [
    { k:'overview', lbl:'📊 General' },
    { k:'map',      lbl:'🗺 Mapa' },
    { k:'drivers',  lbl:'🚖 Conductores' },
    { k:'clients',  lbl:'👥 Clientes' },
    { k:'trips',    lbl:'🛣 Viajes' },
    { k:'ratings',  lbl:'⭐ Ratings' },
  ]

  return (
    <div className="min-h-screen text-white flex flex-col max-w-lg mx-auto relative z-10">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 backdrop-blur border-b border-red-400/20 flex-shrink-0">
        <div>
          <div className="font-black text-red-400 text-lg">⚙️ Admin</div>
          <div className="text-xs text-gray-500">Taxi Virgin Islands</div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <button onClick={loadAll} className="text-xs text-gray-500 hover:text-yellow-400 px-2 py-1 border border-zinc-700 rounded-lg transition">🔄</button>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }} className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 border border-zinc-700 rounded-lg transition">Salir</button>
        </div>
      </div>

      {/* Tabs scroll horizontal */}
      <div className="flex overflow-x-auto border-b border-zinc-800 flex-shrink-0 scrollbar-hide">
        {tabs.map(({ k, lbl }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-shrink-0 px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${tab===k ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {lbl}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <div className="text-center py-12 text-gray-500 text-sm">Cargando...</div>}

        {/* ── OVERVIEW ── */}
        {!loading && tab === 'overview' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon:'👥', val: stats.users,    label:'Usuarios',   color:'text-blue-400' },
                { icon:'🚖', val: stats.drivers,  label:'Conductores',color:'text-yellow-400' },
                { icon:'🟢', val: stats.online,   label:'En línea',   color:'text-green-400' },
                { icon:'🛣', val: stats.trips,    label:'Viajes',     color:'text-purple-400' },
                { icon:'💰', val:`$${stats.earnings}`,label:'Ganancias',color:'text-yellow-400' },
                { icon:'⭐', val: avgRating,      label:'Rating avg', color:'text-yellow-400' },
              ].map(({ icon, val, label, color }) => (
                <div key={label} className="bg-zinc-900/80 backdrop-blur rounded-xl p-3 border border-zinc-800 text-center">
                  <div className="text-xl mb-1">{icon}</div>
                  <div className={`text-lg font-black ${color}`}>{val}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Viajes por estado */}
            <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 text-xs text-gray-500 uppercase tracking-wider font-medium">📊 Viajes por estado</div>
              {[
                { label:'Completados', val:completed, color:'text-green-400', bar:'bg-green-400' },
                { label:'En curso',    val:active,    color:'text-blue-400',  bar:'bg-blue-400' },
                { label:'Cancelados',  val:cancelled, color:'text-red-400',   bar:'bg-red-400' },
                { label:'Solicitados', val:trips.filter(t=>t.status==='requested').length, color:'text-yellow-400', bar:'bg-yellow-400' },
              ].map(({ label, val, color, bar }) => (
                <div key={label} className="px-4 py-3 border-b border-zinc-800/50 last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className={`font-bold text-sm ${color}`}>{val}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5">
                    <div className={`${bar} h-1.5 rounded-full transition-all`}
                      style={{ width: stats.trips > 0 ? `${(val/stats.trips)*100}%` : '0%' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Top conductor */}
            {topDriver && (
              <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-yellow-400/20 p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">🏆 Top Conductor</div>
                <div className="flex items-center gap-3">
                  {topDriver.users?.avatar_url ? (
                    <img src={topDriver.users.avatar_url} className="w-12 h-12 rounded-full border-2 border-yellow-400 object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-yellow-400/10 border-2 border-yellow-400 flex items-center justify-center font-bold text-yellow-400">
                      {topDriver.users?.full_name?.slice(0,2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-bold">{topDriver.users?.full_name}</div>
                    <div className="text-xs text-gray-500">{topDriver.license_plate} · ⭐{topDriver.users?.rating_avg}</div>
                    <div className="text-yellow-400 font-black text-lg">${parseFloat(topDriver.total_earnings||0).toFixed(2)}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full font-medium ${topDriver.is_online ? 'bg-green-400/10 text-green-400' : 'bg-zinc-700 text-gray-400'}`}>
                    {topDriver.is_online ? '🟢 Online' : '⚫ Offline'}
                  </div>
                </div>
              </div>
            )}

            {/* Actividad reciente */}
            <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 text-xs text-gray-500 uppercase tracking-wider">⚡ Actividad reciente</div>
              {trips.slice(0,6).map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/40 last:border-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor(t.status)}`}>{t.status}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-300 truncate">{t.origin_address} → {t.dest_address}</div>
                    <div className="text-xs text-gray-500">{t.users?.full_name} · {new Date(t.requested_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {trips.length === 0 && <div className="px-4 py-6 text-center text-gray-500 text-sm">No hay viajes</div>}
            </div>
          </>
        )}

        {/* ── MAPA EN VIVO ── */}
        {!loading && tab === 'map' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              📡 {stats.online} conductores en línea
            </div>
            <div ref={mapRef} style={{ height: 400, borderRadius: 12, overflow: 'hidden', background: '#18181b' }}>
              {!mapReady && <div className="h-full flex items-center justify-center text-gray-600 text-sm">Cargando mapa...</div>}
            </div>
            {/* Leyenda */}
            <div className="flex gap-4 text-xs text-gray-400 justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Disponible</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Ocupado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-zinc-500 inline-block" /> Offline</span>
            </div>
            {/* Lista con posición */}
            <div className="space-y-2">
              {drivers.map(d => (
                <div key={d.id} className="bg-zinc-900/80 backdrop-blur rounded-xl p-3 border border-zinc-800 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.is_online ? 'bg-green-400' : 'bg-zinc-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.users?.full_name}</div>
                    <div className="text-xs text-gray-500">{d.license_plate}</div>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    {d.current_lat ? `${d.current_lat.toFixed(4)}, ${d.current_lng.toFixed(4)}` : 'Sin GPS'}
                    {d.last_location_at && <div className="text-gray-600">{new Date(d.last_location_at).toLocaleTimeString()}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONDUCTORES ── */}
        {!loading && tab === 'drivers' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{drivers.length} conductores registrados</div>
            {drivers.map(d => (
              <div key={d.id} className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {d.users?.avatar_url ? (
                    <img src={d.users.avatar_url} className="w-12 h-12 rounded-full border-2 border-yellow-400/40 object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-bold text-sm flex-shrink-0">
                      {d.users?.full_name?.slice(0,2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{d.users?.full_name}</div>
                    <div className="text-xs text-gray-500 truncate">{d.users?.email}</div>
                    <div className="text-xs text-gray-500">{d.users?.phone || 'Sin teléfono'}</div>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.is_online ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-zinc-600'}`} />
                </div>
                {/* Stats */}
                <div className="grid grid-cols-4 border-t border-zinc-800">
                  {[
                    { label:'Placa',    val: d.license_plate, mono: true },
                    { label:'Rating',   val: `⭐${d.users?.rating_avg||5}` },
                    { label:'Viajes',   val: d.users?.total_trips||0 },
                    { label:'Ganancias',val: `$${parseFloat(d.total_earnings||0).toFixed(0)}`, color:'text-yellow-400' },
                  ].map(({ label, val, mono, color }) => (
                    <div key={label} className="p-2 text-center border-r border-zinc-800 last:border-0">
                      <div className={`text-sm font-bold ${color || 'text-white'} ${mono ? 'font-mono text-xs' : ''}`}>{val}</div>
                      <div className="text-xs text-gray-600">{label}</div>
                    </div>
                  ))}
                </div>
                {/* Acciones */}
                <div className="flex border-t border-zinc-800">
                  <button onClick={() => toggleDriverOnline(d.id, d.is_online)}
                    className={`flex-1 py-2 text-xs font-bold transition ${d.is_online ? 'text-orange-400 hover:bg-orange-400/10' : 'text-green-400 hover:bg-green-400/10'}`}>
                    {d.is_online ? '⚫ Desconectar' : '🟢 Conectar'}
                  </button>
                  <div className="w-px bg-zinc-800" />
                  <button onClick={() => setConfirm({ type:'driver', id: d.users?.id, authId: d.users?.auth_id, name: d.users?.full_name })}
                    className="flex-1 py-2 text-xs font-bold text-red-400 hover:bg-red-400/10 transition">
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            ))}
            {drivers.length === 0 && <div className="text-center py-12 text-gray-500">No hay conductores</div>}
          </div>
        )}

        {/* ── CLIENTES ── */}
        {!loading && tab === 'clients' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              {users.filter(u => u.role === 'cliente').length} clientes registrados
            </div>
            {users.filter(u => u.role === 'cliente').map(u => (
              <div key={u.id} className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} className="w-11 h-11 rounded-full border border-blue-400/30 object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-400/10 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                      {u.full_name?.slice(0,2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{u.full_name}</div>
                    <div className="text-xs text-gray-500 truncate">{u.email}</div>
                    <div className="text-xs text-gray-600">{u.phone || 'Sin teléfono'} · {new Date(u.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-yellow-400 text-sm font-bold">⭐{u.rating_avg||5}</div>
                    <div className="text-xs text-gray-500">{u.total_trips||0} viajes</div>
                  </div>
                </div>
                <div className="flex border-t border-zinc-800">
                  <div className="flex-1 py-2 text-center text-xs text-gray-500">
                    Registrado: {new Date(u.created_at).toLocaleDateString()}
                  </div>
                  <div className="w-px bg-zinc-800" />
                  <button onClick={() => setConfirm({ type:'client', id: u.id, authId: u.auth_id, name: u.full_name })}
                    className="flex-1 py-2 text-xs font-bold text-red-400 hover:bg-red-400/10 transition">
                    🗑 Eliminar
                  </button>
                </div>
              </div>
            ))}
            {users.filter(u => u.role==='cliente').length === 0 && <div className="text-center py-12 text-gray-500">No hay clientes</div>}
          </div>
        )}

        {/* ── VIAJES ── */}
        {!loading && tab === 'trips' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{trips.length} viajes recientes</div>
            {trips.map(t => (
              <div key={t.id} className="bg-zinc-900/80 backdrop-blur rounded-xl p-4 border border-zinc-800">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(t.status)}`}>{t.status}</span>
                  <span className="text-xs text-gray-500">{new Date(t.requested_at).toLocaleString()}</span>
                </div>
                <div className="space-y-1 text-sm mb-2">
                  <div className="flex gap-2"><span className="text-green-400">📍</span><span className="text-gray-300 truncate">{t.origin_address}</span></div>
                  <div className="flex gap-2"><span className="text-red-400">🏁</span><span className="text-gray-300 truncate">{t.dest_address}</span></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 border-t border-zinc-800 pt-2 mt-2">
                  <span>👤 {t.users?.full_name || 'Cliente'}</span>
                  {t.distance_km && <span>📏 {t.distance_km} km</span>}
                  {t.cancel_reason && <span className="text-red-400 truncate">{t.cancel_reason}</span>}
                </div>
              </div>
            ))}
            {trips.length === 0 && <div className="text-center py-12 text-gray-500">No hay viajes</div>}
          </div>
        )}

        {/* ── RATINGS ── */}
        {!loading && tab === 'ratings' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              {ratings.length} calificaciones · Promedio: ⭐{avgRating}
            </div>
            {/* Distribución de estrellas */}
            <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 p-4">
              {[5,4,3,2,1].map(s => {
                const count = ratings.filter(r => r.stars === s).length
                const pct   = ratings.length ? (count / ratings.length * 100) : 0
                return (
                  <div key={s} className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-400 text-xs w-6">{s}⭐</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
            {ratings.map(r => (
              <div key={r.id} className="bg-zinc-900/80 backdrop-blur rounded-xl p-4 border border-zinc-800">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-yellow-400 text-lg">{'⭐'.repeat(r.stars)}</div>
                  <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-300 mt-1">"{r.comment}"</p>}
                <div className="text-xs text-gray-500 mt-2">Por: {r.users?.full_name || 'Usuario'}</div>
              </div>
            ))}
            {ratings.length === 0 && <div className="text-center py-12 text-gray-500">No hay calificaciones aún</div>}
          </div>
        )}

      </div>

      {/* Modal de confirmación de eliminación */}
      {confirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-6">
          <div className="bg-zinc-900 border border-red-400/30 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-2xl mb-3 text-center">⚠️</div>
            <div className="text-white font-bold text-center mb-2">¿Eliminar usuario?</div>
            <div className="text-gray-400 text-sm text-center mb-6">
              Se eliminará <span className="text-white font-semibold">{confirm.name}</span> y todos sus datos permanentemente.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirm(null)}
                className="py-3 rounded-xl border border-zinc-700 text-gray-400 text-sm hover:border-zinc-500 transition">
                Cancelar
              </button>
              <button onClick={() => deleteUser(confirm.id, confirm.authId, confirm.name)}
                className="py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm transition">
                🗑 Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 text-white text-sm px-5 py-3 rounded-full shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      <ShareButton />
    </div>
  )
}
