import { Component, type ErrorInfo, type ReactNode } from 'react'
import { apiFetch } from '../api/client'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always log to console
    console.error('[ErrorBoundary]', error, info)

    // In production, ship the error to the API sink (fire-and-forget)
    if (import.meta.env.PROD) {
      apiFetch('/client-error', {
        method: 'POST',
        body: JSON.stringify({
          message: error.message,
          stack:   error.stack?.slice(0, 5000),
          url:     window.location.href,
        }),
      }).catch(() => { /* swallow — we're already in an error state */ })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '32px 24px',
          textAlign: 'center',
          background: 'var(--tg-theme-bg-color, #fff)',
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 20 }}>
            <circle cx="32" cy="32" r="30" stroke="var(--color-danger, #ff3b30)" strokeWidth="2" opacity="0.3" />
            <path d="M32 18v18" stroke="var(--color-danger, #ff3b30)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="32" cy="44" r="2.5" fill="var(--color-danger, #ff3b30)" />
          </svg>

          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: 'var(--tg-theme-text-color, #000)' }}>
            Что-то пошло не так
          </div>
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color, #999)', marginBottom: 28, maxWidth: 280, lineHeight: 1.5 }}>
            Произошла неожиданная ошибка. Попробуйте перезагрузить приложение.
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '13px 32px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--tg-theme-button-color, #007aff)',
              color: 'var(--tg-theme-button-text-color, #fff)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Перезагрузить
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
