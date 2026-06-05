import { useState, useEffect } from 'react'
import { calcFare, calcDistance, VI_POINTS } from '../lib/fare'
import { useLang } from '../lib/LangContext'

export default function RideRequest({ userLocation, onRequest, requesting }) {
  const [origin, setOrigin]   = useState(VI_POINTS[0])
  const [dest, setDest]       = useState(VI_POINTS[1])
  const [fare, setFare]       = useState(null)
  const { t, lang } = useLang()

  // Recalcular tarifa cuando cambian origen o destino
  useEffect(() => {
    if (origin && dest && origin.name !== dest.name) {
      const dist = calcDistance(origin.lat, origin.lng, dest.lat, dest.lng)
      setFare(calcFare(dist))
    } else {
      setFare(null)
    }
  }, [origin, dest])

  function handleRequest() {
    if (!fare || !origin || !dest) return
    onRequest({ origin, dest, fare })
  }

  const labelMap = {
    es: { from: 'Origen', to: 'Destino', estimate: 'Estimado de tarifa',
          base: 'Tarifa base', distance: 'Distancia', time: 'Tiempo',
          surge: '🔥 Hora pico', total: 'Total estimado',
          km: 'km', min: 'min', request: '🚖 Confirmar y solicitar',
          samePoint: 'Selecciona un destino diferente' },
    en: { from: 'Origin', to: 'Destination', estimate: 'Fare estimate',
          base: 'Base fare', distance: 'Distance', time: 'Time',
          surge: '🔥 Surge pricing', total: 'Estimated total',
          km: 'km', min: 'min', request: '🚖 Confirm & request',
          samePoint: 'Select a different destination' },
    fr: { from: 'Origine', to: 'Destination', estimate: 'Estimation du tarif',
          base: 'Tarif de base', distance: 'Distance', time: 'Durée',
          surge: '🔥 Heure de pointe', total: 'Total estimé',
          km: 'km', min: 'min', request: '🚖 Confirmer et demander',
          samePoint: 'Sélectionnez une destination différente' },
  }
  const L = labelMap[lang] || labelMap.es

  return (
    <div className="space-y-3">
      {/* Selector Origen */}
      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          📍 {L.from}
        </label>
        <select
          value={origin.name}
          onChange={e => setOrigin(VI_POINTS.find(p => p.name === e.target.value))}
          className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2.5 rounded-xl outline-none focus:border-yellow-400"
        >
          {VI_POINTS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {/* Selector Destino */}
      <div>
        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">
          🏁 {L.to}
        </label>
        <select
          value={dest.name}
          onChange={e => setDest(VI_POINTS.find(p => p.name === e.target.value))}
          className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2.5 rounded-xl outline-none focus:border-yellow-400"
        >
          {VI_POINTS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {/* Desglose de tarifa */}
      {fare && origin.name !== dest.name ? (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
              {L.estimate}
            </span>
            {fare.isSurge && (
              <span className="text-xs text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded-full">
                {L.surge} ×{fare.surge}
              </span>
            )}
          </div>

          {/* Desglose */}
          <div className="px-4 py-3 space-y-2">
            {[
              { label: L.base,     val: `$${fare.baseFare.toFixed(2)}`,     sub: null },
              { label: L.distance, val: `$${fare.distanceCost.toFixed(2)}`, sub: `${fare.distanceKm} ${L.km}` },
              { label: L.time,     val: `$${fare.timeCost.toFixed(2)}`,     sub: `${fare.durationMin} ${L.min}` },
            ].map(({ label, val, sub }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1.5">
                  {label}
                  {sub && <span className="text-gray-600 text-xs">({sub})</span>}
                </span>
                <span className="text-gray-300 font-mono">{val}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-yellow-400/5 border-t border-yellow-400/20">
            <span className="font-bold text-sm text-white">{L.total}</span>
            <span className="font-black text-2xl text-yellow-400">{fare.totalStr}</span>
          </div>
        </div>
      ) : origin.name === dest.name ? (
        <div className="text-center py-3 text-gray-500 text-xs">{L.samePoint}</div>
      ) : null}

      {/* Botón solicitar */}
      <button
        onClick={handleRequest}
        disabled={requesting || !fare || origin.name === dest.name}
        className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-bold py-4 rounded-xl text-base transition disabled:opacity-40"
      >
        {requesting
          ? '⏳ ...'
          : fare && origin.name !== dest.name
            ? `${L.request} · ${fare.totalStr}`
            : L.request}
      </button>
    </div>
  )
}
