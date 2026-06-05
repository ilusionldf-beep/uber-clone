import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../lib/LangContext'
import LangSwitcher from '../components/LangSwitcher'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()
  const { t } = useLang()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    await redirectByRole(data.user)
  }

  async function handleGoogle() {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (err) setError(err.message)
  }

  async function redirectByRole(user) {
    const { data: profile } = await supabase
      .from('users').select('role, email').eq('auth_id', user.id).single()
    if (profile?.email === 'ilusion.ldf@gmail.com') navigate('/admin')
    else if (profile?.role === 'taxista') navigate('/driver')
    else navigate('/client')
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Lang switcher */}
        <div className="flex justify-end mb-4">
          <LangSwitcher />
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl font-black text-white tracking-tight">🚖 <span className="text-yellow-400">UBER</span> CLONE</div>
          <p className="text-gray-500 text-sm mt-1">{t('appTagline')}</p>
        </div>

        <form onSubmit={handleLogin} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">{t('loginEmail')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"
              placeholder="correo@email.com"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">{t('loginPassword')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"
              placeholder="••••••"/>
          </div>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-lg text-sm transition disabled:opacity-50">
            {loading ? t('loginLoading') : t('loginBtn')}
          </button>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-gray-500 text-xs">o</span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>

          {/* Botón Google */}
          <button type="button" onClick={handleGoogle}
            className="w-full bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 rounded-lg text-sm transition flex items-center justify-center gap-3 border border-gray-200">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continuar con Google
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">
          {t('loginNoAccount')}{' '}
          <span onClick={() => navigate('/register')} className="text-yellow-400 cursor-pointer hover:underline">
            {t('loginRegister')}
          </span>
        </p>
      </div>
    </div>
  )
}
