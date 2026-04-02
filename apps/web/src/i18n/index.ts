import WebApp from '@twa-dev/sdk'
import { ru } from './ru'
import { en } from './en'
import type { Translations } from './ru'

function detectLang(): 'ru' | 'en' {
  try {
    const code = WebApp.initDataUnsafe?.user?.language_code ?? ''
    return code.startsWith('ru') ? 'ru' : 'en'
  } catch {
    return 'ru'
  }
}

const lang = detectLang()
const translations: Translations = lang === 'ru' ? ru : en

export function useT(): Translations {
  return translations
}

export { lang }
