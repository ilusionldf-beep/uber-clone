import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../lib/LangContext'
import LangSwitcher from '../components/LangSwitcher'

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', role: 'cliente' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const navigate = useNavigate()
  const { t } = useLang()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. Crear usuario directo en Supabase Auth
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, role: form.role } }
      })
      if (signUpErr) throw signUpErr
      if (!data.user) throw new Error('No se pudo crear el usuario')

      // 2. Insertar perfil en tabla users
      const { error: profileErr } = await supabase.from('users').insert({
        auth_id:   data.user.id,
        role:      form.role,
        full_name: form.full_name,
        phone:     form.phone || null,
        email:     form.email
      })
      // Ignorar error de duplicado
      if (profileErr && profileErr.code !== '23505') throw profileErr

      // 3. Login inmediato
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email, password: form.password
      })
      if (loginErr) throw loginErr

      navigate(form.role === 'taxista' ? '/driver' : '/client')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4"><LangSwitcher /></div>
        <div className="text-center mb-8">
          <div className="text-3xl font-black text-white">{t('registerTitle')}</div>
          <p className="text-gray-500 text-sm mt-1">{t('registerSub')}</p>
        </div>

        <form onSubmit={handleRegister} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-4">
          {[
            { key: 'full_name', tKey: 'registerName',     type: 'text',     placeholder: 'Juan Pérez' },
            { key: 'email',     tKey: 'registerEmail',    type: 'email',    placeholder: 'correo@email.com' },
            { key: 'password',  tKey: 'registerPassword', type: 'password', placeholder: t('registerPasswordHint') },
            { key: 'phone',     tKey: 'registerPhone',    type: 'tel',      placeholder: '+1 340 000 0000' },
          ].map(({ key, tKey, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">{t(tKey)}</label>
              <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
                required={key !== 'phone'} placeholder={placeholder}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"/>
            </div>
          ))}

          <div>
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">{t('registerRole')}</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'cliente', tKey: 'registerPassenger' }, { v: 'taxista', tKey: 'registerDriver' }].map(({ v, tKey }) => (
                <button key={v} type="button" onClick={() => set('role', v)}
                  className={`py-3 rounded-lg border text-sm font-medium transition ${form.role === v ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-zinc-800 border-zinc-700 text-gray-300 hover:border-yellow-400'}`}>
                  {t(tKey)}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-lg text-sm transition disabled:opacity-50">
            {loading ? t('registerLoading') : t('registerBtn')}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">
          {t('registerHaveAccount')}{' '}
          <span onClick={() => navigate('/')} className="text-yellow-400 cursor-pointer hover:underline">{t('registerLogin')}</span>
        </p>
      </div>
    </div>
  )
}
