import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ChooseRole from './ChooseRole'

export default function AuthCallback() {
  const [newUser, setNewUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/'); return }

      const user = session.user
      const name  = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
      const email = user.email

      // Buscar perfil existente
      const { data: existing } = await supabase
        .from('users').select('id, role, email').eq('auth_id', user.id).single()

      if (!existing) {
        // Usuario NUEVO — mostrar pantalla de selección de rol
        setNewUser({ id: user.id, name, email })
      } else {
        // Usuario EXISTENTE — redirigir según rol
        if (existing.email === 'ilusion.ldf@gmail.com') navigate('/admin')
        else if (existing.role === 'taxista') navigate('/driver')
        else navigate('/client')
      }
    })
  }, [])

  // Usuario nuevo → seleccionar rol
  if (newUser) {
    return (
      <ChooseRole
        userId={newUser.id}
        userName={newUser.name}
        userEmail={newUser.email}
      />
    )
  }

  // Cargando...
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-5xl animate-spin">🚖</div>
        <div className="text-white font-semibold">Iniciando sesión...</div>
        <div className="text-gray-500 text-sm">Por favor espera</div>
      </div>
    </div>
  )
}
