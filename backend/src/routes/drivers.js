const express = require('express');
const router = express.Router();
const supabase = require('../middleware/supabase');

// Conductores disponibles
router.get('/available', async (req, res) => {
  const { data, error } = await supabase.from('available_drivers').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Actualizar ubicación GPS del conductor
router.post('/location', async (req, res) => {
  const { driver_id, lat, lng, speed, heading, trip_id } = req.body;
  const { error } = await supabase.rpc('update_driver_location', {
    p_driver_id: driver_id,
    p_lat: lat, p_lng: lng,
    p_speed: speed || null,
    p_heading: heading || null,
    p_trip_id: trip_id || null
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Cambiar estado online/offline
router.patch('/status/:driver_id', async (req, res) => {
  const { is_online, status } = req.body;
  const { error } = await supabase.from('drivers')
    .update({ is_online, status: is_online ? 'available' : 'offline' })
    .eq('id', req.params.driver_id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
