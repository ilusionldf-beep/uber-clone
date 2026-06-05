import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../lib/LangContext'
import LangSwitcher from '../components/LangSwitcher'

export default function AdminApp() {
  const [stats, setStats]     = useState({ users: 0, drivers: 0, trips: 0, online: 0 })
  const [users, setUsers]     = useState([])
  const [drivers, setDrivers] = useState([])
  const [trips, setTrips]     = useState([])
  const [tab, setTab]         = useState('overview')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { t } = useLang()

  useEffect(() => {
    checkAdmin()
    loadAll()
    // Realtime: actualizar stats cuando cambie algo
    const ch = supabase.channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, loadAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/'); return }
    // Solo el admin puede acceder
    const { data } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
    if (!data || data.role === 'cliente') { navigate('/client'); return }
  }

  async function loadAll() {
    setLoading(true)
    try {
      const [usersRes, driversRes, tripsRes, onlineRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select('*, users(full_name, email, rating_avg, total_trips)').order('created_at', { ascending: false }),
        supabase.from('trips').select('*, users!trips_client_id_fkey(full_name)').order('requested_at', { ascending: false }).limit(30),
        supabase.from('drivers').select('id').eq('is_online', true),
      ])
      const u = usersRes.data || []
      const d = driversRes.data || []
      const t = tripsRes.data || []
      const o = onlineRes.data || []
      setUsers(u)
      setDrivers(d)
      setTrips(t)
      setStats({ users: u.length, drivers: d.length, trips: t.length, online: o.length })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const totalEarnings = drivers.reduce((s, d) => s + parseFloat(d.total_earnings || 0), 0)
  const completedTrips = trips.filter(t => t.status === 'completed').length
  const activeTrips = trips.filter(t => ['accepted','in_progress'].includes(t.status)).length

  const statusColor = s => ({
    completed:   'bg-green-400/10 text-green-400',
    requested:   'bg-yellow-400/10 text-yellow-400',
    accepted:    'bg-blue-400/10 text-blue-400',
    in_progress: 'bg-blue-400/10 text-blue-400',
    cancelled:   'bg-red-400/10 text-red-400',
  })[s] || 'bg-zinc-700 text-gray-400'

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-red-400/20 flex-shrink-0">
        <div>
          <div className="font-black text-red-400 text-lg">⚙️ {t('adminTitle')}</div>
          <div className="text-xs text-gray-500">{t('adminSub')}</div>
        </div>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <button onClick={loadAll} className="text-xs text-gray-500 hover:text-yellow-400 transition px-3 py-1 border border-zinc-700 rounded-lg">
            {t('refresh')}
          </button>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 transition px-3 py-1 border border-zinc-700 rounded-lg">
            {t('logout')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 flex-shrink-0">
        {[['overview', t('tabOverview')],['users', t('tabUsers')],['drivers', t('tabDrivers2')],['trips', t('tabTrips')]].map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 text-xs font-semibold transition ${tab === k ? 'text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {lbl}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {loading && (
          <div className="text-center py-12 text-gray-500 text-sm">{t('loading')}</div>
        )}

        {/* ── OVERVIEW ── */}
        {!loading && tab === 'overview' && (
          <>
            {/* KPIs principales */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('totalUsers'),    val: stats.users,    color: 'text-blue-400',   icon: '👥' },
                { label: t('drivers'),       val: stats.drivers,  color: 'text-yellow-400', icon: '🚖' },
                { label: t('driversOnline'), val: stats.online,   color: 'text-green-400',  icon: '🟢' },
                { label: t('totalTrips'),    val: stats.trips,    color: 'text-purple-400', icon: '🗺' },
              ].map(({ label, val, color, icon }) => (
                <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <div className="text-xl mb-1">{icon}</div>
                  <div className={`text-2xl font-black ${color}`}>{val}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Métricas de viajes */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 text-xs text-gray-500 uppercase tracking-wider font-medium">
                {t('tripMetrics')}
              </div>
              {[
                { label: t('completed'),  val: completedTrips, color: 'text-green-400' },
                { label: t('inProgress'), val: activeTrips,    color: 'text-blue-400' },
                { label: t('requested'),  val: trips.filter(x => x.status === 'requested').length, color: 'text-yellow-400' },
                { label: t('cancelled'),  val: trips.filter(x => x.status === 'cancelled').length, color: 'text-red-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 last:border-0">
                  <span className="text-sm text-gray-400">{label}</span>
                  <span className={`font-bold text-lg ${color}`}>{val}</span>
                </div>
              ))}
            </div>

            {/* Ganancias */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 text-xs text-gray-500 uppercase tracking-wider font-medium">
                {t('platformEarnings')}
              </div>
              <div className="p-4 text-center">
                <div className="text-4xl font-black text-yellow-400">${totalEarnings.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">{t('totalEarningsLabel')}</div>
              </div>
            </div>

            {/* Actividad reciente */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 text-xs text-gray-500 uppercase tracking-wider font-medium">
                {t('recentActivity')}
              </div>
              {trips.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-0">
                  <div className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusColor(t.status)}`}>
                    {t.status}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-300 truncate">{t.origin_address} → {t.dest_address}</div>
                    <div className="text-xs text-gray-500">{t.users?.full_name} · {new Date(t.requested_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {trips.length === 0 && <div className="px-4 py-6 text-center text-gray-500 text-sm">{t('noTrips')}</div>}
            </div>
          </>
        )}

        {/* ── USUARIOS ── */}
        {!loading && tab === 'users' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{users.length} usuarios registrados</div>
            {users.map(u => (
              <div key={u.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${u.role === 'taxista' ? 'bg-yellow-400/10 border border-yellow-400/30 text-yellow-400' : 'bg-blue-400/10 border border-blue-400/30 text-blue-400'}`}>
                  {u.full_name?.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{u.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === 'taxista' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'}`}>
                    {u.role}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">⭐ {u.rating_avg}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CONDUCTORES ── */}
        {!loading && tab === 'drivers' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{drivers.length} conductores registrados</div>
            {drivers.map(d => (
              <div key={d.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-bold text-sm flex-shrink-0">
                    {d.users?.full_name?.slice(0,2).toUpperCase() || '??'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{d.users?.full_name}</div>
                    <div className="text-xs text-gray-500">{d.users?.email}</div>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.is_online ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-zinc-600'}`} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-800 rounded-lg p-2">
                    <div className="text-xs font-mono text-yellow-400 font-bold">{d.license_plate}</div>
                    <div className="text-xs text-gray-500">Placa</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2">
                    <div className="text-xs font-bold text-green-400">${parseFloat(d.total_earnings||0).toFixed(0)}</div>
                    <div className="text-xs text-gray-500">Ganancias</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-2">
                    <div className="text-xs font-bold text-blue-400">⭐{d.users?.rating_avg || 5}</div>
                    <div className="text-xs text-gray-500">Rating</div>
                  </div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                  <span>{d.vehicle_model || 'Sin modelo'}</span>
                  <span className={d.is_online ? 'text-green-400' : 'text-zinc-500'}>{d.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VIAJES ── */}
        {!loading && tab === 'trips' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{trips.length} viajes recientes</div>
            {trips.map(t => (
              <div key={t.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(t.requested_at).toLocaleString()}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex gap-2"><span className="text-green-400">📍</span><span className="text-gray-300 truncate">{t.origin_address}</span></div>
                  <div className="flex gap-2"><span className="text-red-400">🏁</span><span className="text-gray-300 truncate">{t.dest_address}</span></div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                  <span>👤 {t.users?.full_name || 'Cliente'}</span>
                  {t.distance_km && <span>📏 {t.distance_km} km</span>}
                </div>
              </div>
            ))}
            {trips.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🗺</div>
                <div className="text-gray-500 text-sm">No hay viajes registrados</div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
