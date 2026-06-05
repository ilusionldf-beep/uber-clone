const express = require('express');
const router = express.Router();
const supabase = require('../middleware/supabase');

// Registro de usuario
router.post('/register', async (req, res) => {
  const { email, password, full_name, phone, role } = req.body;
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  let userId;

  // Intentar crear usuario nuevo
  const { data, error } = await supabase.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name, role }
  });

  if (error) {
    // Si ya existe, buscarlo y actualizar contraseña
    if (error.message.includes('already') || error.message.includes('existe')) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users?.find(u => u.email === email);
      if (!existing) return res.status(400).json({ error: error.message });

      // Actualizar contraseña y confirmar
      await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true
      });
      userId = existing.id;
    } else {
      return res.status(400).json({ error: error.message });
    }
  } else {
    userId = data.user.id;
  }

  // Crear o actualizar perfil en tabla users
  const { error: pe } = await supabase.from('users').upsert({
    auth_id: userId,
    role, full_name, phone: phone || null, email
  }, { onConflict: 'auth_id' });
  if (pe) return res.status(400).json({ error: pe.message });

  res.json({ message: 'Usuario creado', user_id: userId });
});

// Obtener perfil por auth_id
router.get('/profile/:auth_id', async (req, res) => {
  const { data, error } = await supabase
    .from('users').select('*').eq('auth_id', req.params.auth_id).single();
  if (error) return res.status(404).json({ error: 'Perfil no encontrado' });
  res.json(data);
});

module.exports = router;
