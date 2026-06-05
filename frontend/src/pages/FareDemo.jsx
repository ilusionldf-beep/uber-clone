import RideRequest from '../components/RideRequest'
import { LangProvider } from '../lib/LangContext'

export default function FareDemo() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl font-black text-yellow-400">🚖 Demo Tarifa</div>
          <div className="text-gray-500 text-sm mt-1">Selecciona origen y destino</div>
        </div>
        <RideRequest onRequest={d => alert(`Tarifa: ${d.fare.totalStr}`)} requesting={false} />
      </div>
    </div>
  )
}
