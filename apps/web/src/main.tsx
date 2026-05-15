import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WebApp from '@twa-dev/sdk'
import { forceLightTheme } from './lib/forceTheme'
import './styles/theme.css'
import App from './App'

forceLightTheme()

try {
  // Remove Telegram's loading screen, expand to full height
  WebApp.ready()
  WebApp.expand()

  // Always set light theme headers and background, regardless of Telegram theme
  WebApp.setHeaderColor('#ffffff')
  WebApp.setBackgroundColor('#ffffff')
} catch {
  // Running in browser outside Telegram — all WebApp calls are no-ops or may throw
  console.warn('[povar] Telegram WebApp SDK not available, running in browser mode')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
