// ============================================================
//  UBER CLONE — Motor de tarifas
// ============================================================

export const FARE_CONFIG = {
  base:        3.00,   // Tarifa base (arranque)
  perKm:       1.75,   // Por kilómetro
  perMin:      0.25,   // Por minuto
  minFare:     5.00,   // Tarifa mínima
  surgeHours:  [7,8,9,17,18,19], // Horas pico
  surgeMult:   1.4,    // Multiplicador hora pico
  currency:    'USD',
  symbol:      '$',
}

/**
 * Calcula distancia en km usando fórmula de Haversine
 */
export function calcDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lat2) return 0
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 100) / 100
}

/**
 * Calcula duración estimada (aprox. 2.5 min/km en ciudad)
 */
export function calcDuration(distanceKm) {
  return Math.max(3, Math.round(distanceKm * 2.5))
}

/**
 * Calcula la tarifa completa
 */
export function calcFare(distanceKm) {
  const cfg   = FARE_CONFIG
  const hour  = new Date().getHours()
  const surge = cfg.surgeHours.includes(hour) ? cfg.surgeMult : 1.0
  const duration = calcDuration(distanceKm)

  const distCost  = distanceKm * cfg.perKm
  const timeCost  = duration   * cfg.perMin
  const subtotal  = cfg.base + distCost + timeCost
  const total     = Math.max(cfg.minFare, subtotal * surge)

  return {
    distanceKm,
    durationMin:  duration,
    baseFare:     cfg.base,
    distanceCost: Math.round(distCost * 100) / 100,
    timeCost:     Math.round(timeCost * 100) / 100,
    surge,
    isSurge:      surge > 1,
    total:        Math.round(total * 100) / 100,
    totalStr:     `$${total.toFixed(2)}`,
  }
}

/**
 * Puntos conocidos de Virgin Islands para demo
 */
export const VI_POINTS = [
  { name: 'Charlotte Amalie',    lat: 18.3428, lng: -64.9308 },
  { name: 'Aeropuerto',          lat: 18.3373, lng: -64.9733 },
  { name: 'Havensight Mall',     lat: 18.3308, lng: -64.9208 },
  { name: 'Red Hook',            lat: 18.3178, lng: -64.8663 },
  { name: 'Magens Bay',          lat: 18.3808, lng: -64.9278 },
  { name: 'Hospital Regional',   lat: 18.3468, lng: -64.9468 },
  { name: 'Universidad',         lat: 18.3558, lng: -64.9063 },
  { name: 'Cruz Bay, St. John',  lat: 18.3308, lng: -64.7958 },
]
