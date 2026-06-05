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
    const { data: profile } = await supabase
      .from('users').select('role, email').eq('auth_id', data.user.id).single()
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
