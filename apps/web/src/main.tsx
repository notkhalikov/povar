import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import WebApp from '@twa-dev/sdk'
import './styles/theme.css'
import App from './App'

try {
  // Remove Telegram's loading screen, expand to full height
  WebApp.ready()
  WebApp.expand()

  // Match header and background to the current Telegram theme
  const bg = WebApp.themeParams.bg_color ?? '#ffffff'
  WebApp.setHeaderColor(bg as `#${string}`)
  WebApp.setBackgroundColor(bg as `#${string}`)
} catch {
  // Running in browser outside Telegram — all WebApp calls are no-ops or may throw
  console.warn('[povar] Telegram WebApp SDK not available, running in browser mode')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
