import { createContext, useContext, useState } from 'react'
import { translations } from './i18n'

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'es')

  function changeLang(code) {
    setLang(code)
    localStorage.setItem('lang', code)
  }

  function t(key) {
    return translations[lang]?.[key] ?? translations.es[key] ?? key
  }

  return (
    <LangContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
