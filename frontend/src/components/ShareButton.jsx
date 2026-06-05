export default function ShareButton() {
  function shareWhatsApp() {
    const url   = 'https://taxivirginislands.netlify.app'
    const texto = `🚖 ¡Únete a *Taxi Virgin Islands*!\n\nSolicita tu taxi en las Islas Vírgenes de forma fácil y rápida.\n\n👉 ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <button
      onClick={shareWhatsApp}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#20b858] active:scale-95 text-white font-bold px-4 py-3 rounded-full shadow-xl transition"
      title="Compartir por WhatsApp"
    >
      {/* Ícono de WhatsApp */}
      <svg width="20" height="20" viewBox="0 0 32 32" fill="white">
        <path d="M16 0C7.164 0 0 7.163 0 16c0 2.822.737 5.469 2.027 7.77L0 32l8.456-2.01A15.93 15.93 0 0016 32c8.836 0 16-7.163 16-16S24.836 0 16 0zm0 29.333a13.267 13.267 0 01-6.769-1.848l-.486-.29-5.02 1.194 1.218-4.87-.317-.5A13.233 13.233 0 012.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333z"/>
        <path d="M23.5 19.5c-.4-.2-2.3-1.1-2.65-1.25-.35-.15-.6-.2-.85.2-.25.4-.95 1.25-1.15 1.5-.2.25-.45.3-.85.1-.4-.2-1.65-.6-3.15-1.9-1.15-1.05-1.95-2.3-2.15-2.7-.2-.4 0-.6.2-.8.15-.15.4-.45.55-.65.15-.2.2-.35.3-.6.1-.25.05-.45-.05-.65-.1-.2-.85-2.1-1.15-2.85-.3-.75-.6-.65-.85-.65h-.7c-.25 0-.65.1-1 .45-.35.35-1.3 1.25-1.3 3.1s1.35 3.6 1.55 3.85c.2.25 2.65 4.15 6.5 5.65 2.5.95 3.45 1 4.7.8.75-.1 2.3-.95 2.65-1.9.35-.95.35-1.75.25-1.9-.1-.15-.35-.25-.75-.45z"/>
      </svg>
      <span className="text-sm">Compartir App</span>
    </button>
  )
}
