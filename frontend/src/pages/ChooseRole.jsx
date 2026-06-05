import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'

export default function ChooseRole({ userId, userName, userEmail, userAvatar }) {
  const [name, setName]   = useState(userName || '')
  const [phone, setPhone] = useState('')
  const [role, setRole]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const navigate = useNavigate()
  const { lang } = useLang()

  const L = {
    es: {
      title: 'Completa tu registro',
      sub: 'Un momento más antes de entrar',
      name: 'Nombre completo',
      phone: 'Teléfono',
      phonePh: '+1 340 000 0000',
      role: 'Tipo de cuenta',
      passenger: '🚖 Pasajero',
      passengerSub: 'Solicito viajes',
      driver: '🚕 Conductor',
      driverSub: 'Ofrezco viajes',
      btn: 'Entrar a la app',
      loading: 'Guardando...',
      errorRole: 'Selecciona un tipo de cuenta',
      errorName: 'Escribe tu nombre',
    },
    en: {
      title: 'Complete your registration',
      sub: 'One more step before entering',
      name: 'Full name',
      phone: 'Phone',
      phonePh: '+1 340 000 0000',
      role: 'Account type',
      passenger: '🚖 Passenger',
      passengerSub: 'I request rides',
      driver: '🚕 Driver',
      driverSub: 'I offer rides',
      btn: 'Enter the app',
      loading: 'Saving...',
      errorRole: 'Select an account type',
      errorName: 'Enter your name',
    },
    fr: {
      title: 'Complétez votre inscription',
      sub: 'Encore une étape avant d\'entrer',
      name: 'Nom complet',
      phone: 'Téléphone',
      phonePh: '+1 340 000 0000',
      role: 'Type de compte',
      passenger: '🚖 Passager',
      passengerSub: 'Je demande des trajets',
      driver: '🚕 Chauffeur',
      driverSub: 'J\'offre des trajets',
      btn: 'Entrer dans l\'app',
      loading: 'Sauvegarde...',
      errorRole: 'Sélectionnez un type de compte',
      errorName: 'Entrez votre nom',
    },
  }[lang] || {
    title: 'Completa tu registro', sub: 'Un momento más',
    name: 'Nombre completo', phone: 'Teléfono', phonePh: '+1 340 000 0000',
    role: 'Tipo de cuenta', passenger: '🚖 Pasajero', passengerSub: 'Solicito viajes',
    driver: '🚕 Conductor', driverSub: 'Ofrezco viajes', btn: 'Entrar a la app',
    loading: 'Guardando...', errorRole: 'Selecciona un tipo de cuenta', errorName: 'Escribe tu nombre',
  }

  async function handleConfirm() {
    if (!name.trim()) { setError(L.errorName); return }
    if (!role) { setError(L.errorRole); return }
    setError('')
    setLoading(true)

    // 1. Crear perfil de usuario
    const { data: newUser, error: err } = await supabase.from('users').upsert({
      auth_id:   userId,
      role,
      full_name: name.trim(),
      email:     userEmail,
      phone:     phone.trim() || null,
    }, { onConflict: 'auth_id' }).select().single()

    if (err) { setError(err.message); setLoading(false); return }

    // 2. Si es conductor → crear perfil de driver automáticamente
    if (role === 'taxista' && newUser) {
      await supabase.from('drivers').upsert({
        user_id:       newUser.id,
        license_plate: 'PENDIENTE',
        vehicle_model: 'Sin especificar',
        status:        'offline',
        is_online:     false,
      }, { onConflict: 'user_id' })
    }

    setLoading(false)
    navigate(role === 'taxista' ? '/driver' : '/client')
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          {userAvatar ? (
            <img src={userAvatar} alt="avatar"
              className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-yellow-400" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-yellow-400/10 border-2 border-yellow-400 flex items-center justify-center text-2xl font-bold text-yellow-400 mx-auto mb-3">
              {name?.slice(0,1).toUpperCase() || '?'}
            </div>
          )}
          <div className="text-xl font-black text-white">{L.title}</div>
          <p className="text-gray-500 text-sm mt-1">{L.sub}</p>
          <p className="text-gray-600 text-xs mt-0.5">{userEmail}</p>
        </div>

        {/* Formulario */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
              {L.name}
            </label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"
              placeholder="Juan Pérez"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
              {L.phone} <span className="text-zinc-600 normal-case">(opcional)</span>
            </label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"
              placeholder={L.phonePh}
            />
          </div>

          {/* Tipo de cuenta */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
              {L.role}
            </label>
            <div className="grid grid-cols-2 gap-3">

              <button onClick={() => setRole('cliente')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                  role === 'cliente'
                    ? 'bg-yellow-400/10 border-yellow-400'
                    : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                }`}>
                <span className="text-3xl">🚖</span>
                <div>
                  <div className={`font-bold text-sm ${role === 'cliente' ? 'text-yellow-400' : 'text-white'}`}>
                    {L.passenger}
                  </div>
                  <div className="text-xs text-gray-500">{L.passengerSub}</div>
                </div>
                {role === 'cliente' && (
                  <div className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                    <span className="text-black text-xs font-black">✓</span>
                  </div>
                )}
              </button>

              <button onClick={() => setRole('taxista')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                  role === 'taxista'
                    ? 'bg-yellow-400/10 border-yellow-400'
                    : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'
                }`}>
                <span className="text-3xl">🚕</span>
                <div>
                  <div className={`font-bold text-sm ${role === 'taxista' ? 'text-yellow-400' : 'text-white'}`}>
                    {L.driver}
                  </div>
                  <div className="text-xs text-gray-500">{L.driverSub}</div>
                </div>
                {role === 'taxista' && (
                  <div className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                    <span className="text-black text-xs font-black">✓</span>
                  </div>
                )}
              </button>

            </div>
          </div>

          {/* Error */}
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          {/* Botón */}
          <button onClick={handleConfirm} disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-bold py-3.5 rounded-xl text-base transition disabled:opacity-50">
            {loading ? L.loading : L.btn}
          </button>

        </div>
      </div>
    </div>
  )
}
