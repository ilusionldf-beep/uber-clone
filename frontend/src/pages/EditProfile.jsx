import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../lib/LangContext'
import LangSwitcher from '../components/LangSwitcher'

export default function EditProfile() {
  const [user, setUser]         = useState(null)
  const [driver, setDriver]     = useState(null)
  const [avatar, setAvatar]     = useState(null)   // URL actual
  const [uploading, setUploading] = useState(false)
  const [form, setForm]     = useState({
    full_name: '', phone: '',
    license_plate: '', vehicle_model: '', vehicle_color: '', vehicle_year: ''
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const navigate = useNavigate()
  const { lang } = useLang()

  const L = {
    es: {
      title: 'Editar perfil', back: '← Volver',
      avatar: 'Foto de perfil', name: 'Nombre completo',
      phone: 'Teléfono', email: 'Correo (no editable)',
      vehicle: 'Datos del vehículo', plate: 'Placa',
      model: 'Modelo', color: 'Color', year: 'Año',
      save: 'Guardar cambios', saving: 'Guardando...', saved: '✅ Guardado',
      role: 'Tipo de cuenta',
    },
    en: {
      title: 'Edit profile', back: '← Back',
      avatar: 'Profile photo', name: 'Full name',
      phone: 'Phone', email: 'Email (not editable)',
      vehicle: 'Vehicle info', plate: 'License plate',
      model: 'Model', color: 'Color', year: 'Year',
      save: 'Save changes', saving: 'Saving...', saved: '✅ Saved',
      role: 'Account type',
    },
    fr: {
      title: 'Modifier le profil', back: '← Retour',
      avatar: 'Photo de profil', name: 'Nom complet',
      phone: 'Téléphone', email: 'Email (non modifiable)',
      vehicle: 'Infos véhicule', plate: 'Plaque',
      model: 'Modèle', color: 'Couleur', year: 'Année',
      save: 'Sauvegarder', saving: 'Sauvegarde...', saved: '✅ Sauvegardé',
      role: 'Type de compte',
    },
  }[lang] || {}

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { navigate('/'); return }

    const { data: profile } = await supabase
      .from('users').select('*').eq('auth_id', authUser.id).single()
    if (!profile) { navigate('/'); return }
    setUser(profile)
    setAvatar(profile.avatar_url || null)

    if (profile.role === 'taxista') {
      const { data: driverData } = await supabase
        .from('drivers').select('*').eq('user_id', profile.id).single()
      setDriver(driverData)
      setForm({
        full_name:     profile.full_name || '',
        phone:         profile.phone || '',
        license_plate: driverData?.license_plate || '',
        vehicle_model: driverData?.vehicle_model || '',
        vehicle_color: driverData?.vehicle_color || '',
        vehicle_year:  driverData?.vehicle_year || '',
      })
    } else {
      setForm({ full_name: profile.full_name || '', phone: profile.phone || '',
        license_plate: '', vehicle_model: '', vehicle_color: '', vehicle_year: '' })
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validar tamaño (máx 3MB)
    if (file.size > 3 * 1024 * 1024) {
      setError('La imagen no puede superar 3MB'); return
    }

    setUploading(true)
    setError('')

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const ext  = file.name.split('.').pop()
      const path = `${authUser.id}/avatar.${ext}`

      // Subir a Supabase Storage
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Guardar URL en el perfil
      await supabase.from('users')
        .update({ avatar_url: publicUrl }).eq('id', user.id)

      setAvatar(publicUrl + '?t=' + Date.now())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError('Error al subir la imagen: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError('El nombre es requerido'); return }
    setLoading(true)
    setError('')

    // Actualizar perfil de usuario
    await supabase.from('users').update({
      full_name: form.full_name.trim(),
      phone:     form.phone.trim() || null,
    }).eq('id', user.id)

    // Si es conductor → actualizar datos del vehículo
    if (user.role === 'taxista' && driver) {
      await supabase.from('drivers').update({
        license_plate: form.license_plate.trim() || 'PENDIENTE',
        vehicle_model: form.vehicle_model.trim() || 'Sin especificar',
        vehicle_color: form.vehicle_color.trim() || null,
        vehicle_year:  form.vehicle_year ? parseInt(form.vehicle_year) : null,
      }).eq('id', driver.id)
    }

    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center relative z-10">
      <div className="text-4xl animate-spin">🚖</div>
    </div>
  )

  const initials = form.full_name?.slice(0,2).toUpperCase() || '??'

  return (
    <div className="min-h-screen text-white flex flex-col max-w-md mx-auto relative z-10">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <button onClick={() => navigate(user.role === 'taxista' ? '/driver' : '/client')}
          className="text-gray-400 hover:text-white transition text-sm">
          {L.back}
        </button>
        <div className="font-bold text-white">{L.title}</div>
        <LangSwitcher />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Avatar */}
        <div className="flex flex-col items-center py-4">
          <div className="relative mb-3">
            {avatar ? (
              <img src={avatar} alt="avatar"
                className="w-24 h-24 rounded-full border-2 border-yellow-400 object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-yellow-400/10 border-2 border-yellow-400 flex items-center justify-center text-3xl font-bold text-yellow-400">
                {initials}
              </div>
            )}
            {/* Botón cambiar foto */}
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-yellow-400 hover:bg-yellow-300 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition active:scale-95">
              {uploading ? (
                <span className="text-black text-xs animate-spin">⏳</span>
              ) : (
                <span className="text-black text-sm font-bold">📷</span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={uploadAvatar}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-1">Toca 📷 para cambiar la foto</p>
          <div className="text-xs text-gray-500">{user.email}</div>
          <div className={`text-xs mt-1 px-3 py-1 rounded-full font-medium ${
            user.role === 'taxista' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'
          }`}>
            {user.role === 'taxista' ? '🚕 Conductor' : '🚖 Pasajero'}
          </div>
        </div>

        {/* Datos personales */}
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            👤 {L.title}
          </div>

          {[
            { key: 'full_name', label: L.name,  type: 'text', placeholder: 'Juan Pérez', required: true },
            { key: 'phone',     label: L.phone,  type: 'tel',  placeholder: '+1 340 000 0000' },
          ].map(({ key, label, type, placeholder, required }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">{label}</label>
              <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
                placeholder={placeholder} required={required}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"/>
            </div>
          ))}
        </div>

        {/* Datos del vehículo — solo conductores */}
        {user.role === 'taxista' && (
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              🚕 {L.vehicle}
            </div>

            {[
              { key: 'license_plate', label: L.plate, placeholder: 'VI-1234' },
              { key: 'vehicle_model', label: L.model, placeholder: 'Toyota Camry' },
              { key: 'vehicle_color', label: L.color, placeholder: 'Blanco' },
              { key: 'vehicle_year',  label: L.year,  placeholder: '2022', type: 'number' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">{label}</label>
                <input type={type || 'text'} value={form[key]} onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-yellow-400"/>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        {/* Botón guardar */}
        <button onClick={handleSave} disabled={loading}
          className={`w-full font-bold py-4 rounded-xl text-base transition ${
            saved
              ? 'bg-green-400 text-black'
              : 'bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black disabled:opacity-50'
          }`}>
          {saved ? L.saved : loading ? L.saving : L.save}
        </button>

        {/* Cerrar sesión */}
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }}
          className="w-full py-3 rounded-xl border border-red-400/30 text-red-400 text-sm hover:bg-red-400/10 transition">
          🚪 Cerrar sesión
        </button>

      </div>
    </div>
  )
}
