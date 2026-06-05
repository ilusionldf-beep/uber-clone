const express = require('express');
const router = express.Router();
const supabase = require('../middleware/supabase');

// Solicitar un viaje
router.post('/request', async (req, res) => {
  const { client_id, origin_address, origin_lat, origin_lng, dest_address, dest_lat, dest_lng, notes } = req.body;
  if (!client_id || !origin_address || !dest_address) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const { data, error } = await supabase.rpc('request_trip', {
    p_client_id:   client_id,
    p_origin_addr: origin_address,
    p_origin_lat:  origin_lat,
    p_origin_lng:  origin_lng,
    p_dest_addr:   dest_address,
    p_dest_lat:    dest_lat,
    p_dest_lng:    dest_lng,
    p_notes:       notes || null
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ trip_id: data });
});

// Conductor acepta viaje
router.post('/accept', async (req, res) => {
  const { trip_id, driver_id } = req.body;
  const { data, error } = await supabase.rpc('accept_trip', {
    p_trip_id: trip_id, p_driver_id: driver_id
  });
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(409).json({ error: 'Viaje ya tomado o no disponible' });
  res.json({ success: true });
});

// Completar viaje
router.post('/complete', async (req, res) => {
  const { trip_id, distance_km, duration_min } = req.body;
  const { data, error } = await supabase.rpc('complete_trip', {
    p_trip_id: trip_id, p_distance_km: distance_km, p_duration_min: duration_min
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: data });
});

// Historial de viajes del cliente
router.get('/history/:client_id', async (req, res) => {
  const { data, error } = await supabase
    .from('client_trip_history').select('*').eq('client_id', req.params.client_id).limit(20);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
