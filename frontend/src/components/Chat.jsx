import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'

export default function Chat({ tripId, senderId, senderName, otherName, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef(null)
  const { t } = useLang()

  useEffect(() => {
    if (!tripId) return
    loadMessages()

    // Realtime — escuchar nuevos mensajes
    const ch = supabase.channel(`chat-${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `trip_id=eq.${tripId}`
      }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [tripId])

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  async function sendMessage(e) {
    e?.preventDefault()
    if (!text.trim() || !tripId || !senderId) return
    setSending(true)
    const msg = text.trim()
    setText('')
    await supabase.from('messages').insert({
      trip_id:   tripId,
      sender_id: senderId,
      content:   msg,
      type:      'text'
    })
    setSending(false)
  }

  async function shareLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async pos => {
      await supabase.from('messages').insert({
        trip_id:   tripId,
        sender_id: senderId,
        content:   '📍 Ubicación compartida',
        type:      'location',
        loc_lat:   pos.coords.latitude,
        loc_lng:   pos.coords.longitude
      })
    })
  }

  const isMine = msg => msg.sender_id === senderId

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col max-w-md mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <button onClick={onClose}
          className="w-9 h-9 rounded-full border border-zinc-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-zinc-500 transition">
          ←
        </button>
        <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-bold text-sm">
          {otherName?.slice(0, 2).toUpperCase() || '??'}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">{otherName}</div>
          <div className="text-xs text-green-400 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {t('chatOnline')}
          </div>
        </div>
        <div className="text-xs text-gray-500 font-mono truncate max-w-[80px]">
          {tripId?.slice(0, 8)}...
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <div className="text-gray-500 text-sm">{t('chatStart')}</div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${isMine(msg) ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
              isMine(msg)
                ? 'bg-yellow-400 text-black rounded-br-sm'
                : 'bg-zinc-800 text-white rounded-bl-sm border border-zinc-700'
            }`}>
              {msg.type === 'location' ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg">📍</span>
                  <div>
                    <div className="font-medium text-xs">{msg.content}</div>
                    {msg.loc_lat && (
                      <a
                        href={`https://maps.google.com/?q=${msg.loc_lat},${msg.loc_lng}`}
                        target="_blank" rel="noreferrer"
                        className={`text-xs underline ${isMine(msg) ? 'text-black/70' : 'text-yellow-400'}`}
                      >
                        Ver en Google Maps →
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
              <div className={`text-xs mt-1 ${isMine(msg) ? 'text-black/50' : 'text-gray-500'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-t border-zinc-800 flex-shrink-0">
        <button type="button" onClick={shareLocation}
          className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-lg hover:border-yellow-400 transition flex-shrink-0">
          📍
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('chatPlaceholder')}
          className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm px-4 py-2.5 rounded-full outline-none focus:border-yellow-400 placeholder-gray-500"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button type="submit" disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 flex items-center justify-center text-black font-bold transition flex-shrink-0">
          ↑
        </button>
      </form>
    </div>
  )
}
