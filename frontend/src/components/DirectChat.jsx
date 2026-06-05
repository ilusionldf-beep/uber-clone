import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext'

// Chat directo entre cliente y conductor (sin trip_id)
// Usa Supabase Realtime broadcast channel
export default function DirectChat({ senderId, senderName, receiverId, receiverName, receiverAvatar, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef(null)
  const channelRef = useRef(null)
  const { t } = useLang()

  // Canal único ordenado por IDs para que sea el mismo en ambos lados
  const channelId = [senderId, receiverId].sort().join('-')

  useEffect(() => {
    if (!senderId || !receiverId) return

    // Cargar mensajes del localStorage (para persistencia simple)
    const stored = JSON.parse(localStorage.getItem(`chat-${channelId}`) || '[]')
    setMessages(stored)

    // Realtime broadcast
    channelRef.current = supabase.channel(`direct-${channelId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages(prev => {
          const updated = [...prev, payload]
          localStorage.setItem(`chat-${channelId}`, JSON.stringify(updated))
          return updated
        })
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [senderId, receiverId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e?.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    const msg = {
      id:        Date.now(),
      sender_id: senderId,
      content:   text.trim(),
      created_at: new Date().toISOString()
    }
    // Guardar localmente
    const updated = [...messages, msg]
    localStorage.setItem(`chat-${channelId}`, JSON.stringify(updated))
    setMessages(updated)
    setText('')

    // Broadcast al otro usuario
    await channelRef.current?.send({ type: 'broadcast', event: 'message', payload: msg })
    setSending(false)
  }

  const isMine = msg => msg.sender_id === senderId

  return (
    <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <button onClick={onClose}
          className="w-9 h-9 rounded-full border border-zinc-700 flex items-center justify-center text-gray-400 hover:text-white transition">
          ←
        </button>
        {receiverAvatar ? (
          <img src={receiverAvatar} className="w-9 h-9 rounded-full border border-yellow-400/30" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-bold text-sm">
            {receiverName?.slice(0,2).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">{receiverName}</div>
          <div className="text-xs text-green-400 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {t('chatOnline')}
          </div>
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
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${isMine(msg) ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
              isMine(msg)
                ? 'bg-yellow-400 text-black rounded-br-sm'
                : 'bg-zinc-800 text-white rounded-bl-sm border border-zinc-700'
            }`}>
              <span>{msg.content}</span>
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
        <input
          value={text} onChange={e => setText(e.target.value)}
          placeholder={t('chatPlaceholder')}
          className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm px-4 py-2.5 rounded-full outline-none focus:border-yellow-400 placeholder-gray-500"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button type="submit" disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 flex items-center justify-center text-black font-bold transition">
          ↑
        </button>
      </form>
    </div>
  )
}
