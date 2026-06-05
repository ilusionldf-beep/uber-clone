import { useLang } from '../lib/LangContext'
import { LANGS } from '../lib/i18n'

export default function LangSwitcher({ className = '' }) {
  const { lang, changeLang } = useLang()

  return (
    <div className={`flex gap-1 ${className}`}>
      {LANGS.map(({ code, label, flag }) => (
        <button
          key={code}
          onClick={() => changeLang(code)}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition leading-none ${
            lang === code
              ? 'bg-yellow-400 text-black'
              : 'bg-zinc-800 text-gray-500 hover:text-white border border-zinc-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
