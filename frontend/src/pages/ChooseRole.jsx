import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'

export default function ChooseRole({ userId, userName, userEmail }) {
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { lang } = useLang()

  const labels = {
    es: {
      title: '¿Cómo quieres usar la app?',
      sub: `Hola ${userName?.split(' ')[0]} 👋 Elige tu tipo de cuenta`,
      passenger: 'Pasajero',
      passengerSub: 'Solicito viajes',
      driver: 'Conductor',
      driverSub: 'Ofrezco viajes',
      confirm: 'Confirmar y entrar',
    },
    en: {
      title: 'How do you want to use the app?',
      sub: `Hello ${userName?.split(' ')[0]} 👋 Choose your account type`,
      passenger: 'Passenger',
      passengerSub: 'I request rides',
      driver: 'Driver',
      driverSub: 'I offer rides',
      confirm: 'Confirm & enter',
    },
    fr: {
      title: 'Comment voulez-vous utiliser l\'app ?',
      sub: `Bonjour ${userName?.split(' ')[0]} 👋 Choisissez votre type de compte`,
      passenger: 'Passager',
      passengerSub: 'Je demande des trajets',
      driver: 'Chauffeur',
      driverSub: 'J\'offre des trajets',
      confirm: 'Confirmer et entrer',
    },
  }
  const L = labels[lang] || labels.es

  async function handleConfirm() {
    if (!role) return
    setLoading(true)
    await supabase.from('users').upsert({
      auth_id:   userId,
      role,
      full_name: userName || userEmail?.split('@')[0],
      email:     userEmail,
    }, { onConflict: 'auth_id' })
    setLoading(false)
    navigate(role === 'taxista' ? '/driver' : '/client')
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚖</div>
          <div className="text-2xl font-black text-white">{L.title}</div>
          <p className="text-gray-400 text-sm mt-2">{L.sub}</p>
        </div>

        {/* Opciones */}
        <div className="grid grid-cols-2 gap-4 mb-6">

          {/* Pasajero */}
          <button onClick={() => setRole('cliente')}
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition ${
              role === 'cliente'
                ? 'bg-yellow-400/10 border-yellow-400'
                : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
            }`}>
            <div className="text-5xl">🚖</div>
            <div>
              <div className={`font-bold text-sm ${role === 'cliente' ? 'text-yellow-400' : 'text-white'}`}>
                {L.passenger}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{L.passengerSub}</div>
            </div>
            {role === 'cliente' && (
              <div className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                <span className="text-black text-xs font-black">✓</span>
              </div>
            )}
          </button>

          {/* Conductor */}
          <button onClick={() => setRole('taxista')}
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition ${
              role === 'taxista'
                ? 'bg-yellow-400/10 border-yellow-400'
                : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'
            }`}>
            <div className="text-5xl">🚕</div>
            <div>
              <div className={`font-bold text-sm ${role === 'taxista' ? 'text-yellow-400' : 'text-white'}`}>
                {L.driver}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{L.driverSub}</div>
            </div>
            {role === 'taxista' && (
              <div className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                <span className="text-black text-xs font-black">✓</span>
              </div>
            )}
          </button>
        </div>

        {/* Botón confirmar */}
        <button onClick={handleConfirm} disabled={!role || loading}
          className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-4 rounded-xl text-base transition disabled:opacity-40">
          {loading ? '⏳ ...' : L.confirm}
        </button>

      </div>
    </div>
  )
}
