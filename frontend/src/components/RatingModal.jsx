import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'

export default function RatingModal({ trip, raterId, ratedId, onClose }) {
  const [stars, setStars]     = useState(0)
  const [hover, setHover]     = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const { t } = useLang()

  async function submitRating() {
    if (!stars) return
    setLoading(true)
    await supabase.from('ratings').insert({
      trip_id:    trip.id,
      rated_by:   raterId,
      rated_user: ratedId,
      stars,
      comment: comment.trim() || null
    })
    setLoading(false)
    setDone(true)
    setTimeout(onClose, 1800)
  }

  if (done) return (
    <div className="fixed inset-0 bg-zinc-950/95 z-50 flex flex-col items-center justify-center gap-4">
      <div className="text-6xl animate-bounce">⭐</div>
      <div className="text-white font-bold text-xl">{t('ratingThanks')}</div>
      <div className="text-gray-400 text-sm">{t('ratingClosing')}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-zinc-950/95 z-50 flex flex-col items-center justify-center px-6 gap-6">

      {/* Ícono */}
      <div className="text-6xl">🚖</div>

      {/* Título */}
      <div className="text-center">
        <div className="text-white font-black text-2xl mb-1">{t('ratingTitle')}</div>
        <div className="text-gray-400 text-sm">
          {trip.origin_address} → {trip.dest_address}
        </div>
      </div>

      {/* Estrellas */}
      <div className="flex gap-3">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="text-5xl transition-transform hover:scale-110 active:scale-95"
          >
            <span className={n <= (hover || stars) ? 'opacity-100' : 'opacity-20'}>⭐</span>
          </button>
        ))}
      </div>

      {/* Label estrellas */}
      {(hover || stars) > 0 && (
        <div className="text-yellow-400 font-semibold text-sm -mt-2">
          {t('ratingLabels')[hover || stars]}
        </div>
      )}

      {/* Comentario */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder={t('ratingComment')}
        maxLength={200}
        rows={3}
        className="w-full max-w-sm bg-zinc-800 border border-zinc-700 text-white text-sm px-4 py-3 rounded-xl outline-none focus:border-yellow-400 placeholder-gray-500 resize-none"
      />

      {/* Botones */}
      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-zinc-700 text-gray-400 text-sm hover:border-zinc-500 transition">
          {t('ratingSkip')}
        </button>
        <button onClick={submitRating} disabled={!stars || loading}
          className="flex-2 flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm disabled:opacity-40 transition">
          {loading ? '...' : `${t('ratingSend')} ${stars ? '⭐'.repeat(stars) : ''}`}
        </button>
      </div>
    </div>
  )
}
