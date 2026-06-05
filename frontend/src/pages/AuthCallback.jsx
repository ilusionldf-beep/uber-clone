import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/'); return }

      const user = session.user
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

      // Crear perfil si no existe
      const { data: existing } = await supabase
        .from('users').select('id, role, email').eq('auth_id', user.id).single()

      if (!existing) {
        await supabase.from('users').insert({
          auth_id:   user.id,
          role:      'cliente',
          full_name: name,
          email:     user.email,
          phone:     null
        })
        navigate('/client')
      } else {
        if (existing.email === 'ilusion.ldf@gmail.com') navigate('/admin')
        else if (existing.role === 'taxista') navigate('/driver')
        else navigate('/client')
      }
    })
  }, [])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-4xl animate-spin">🚖</div>
        <div className="text-white font-semibold">Iniciando sesión...</div>
        <div className="text-gray-500 text-sm">Por favor espera</div>
      </div>
    </div>
  )
}
