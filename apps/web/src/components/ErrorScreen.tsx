import { useT } from '../i18n'

interface ErrorScreenProps {
  message?: string
  onRetry?: () => void
}

export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  const t = useT()
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      minHeight: 240,
    }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16 }}>
        <circle cx="32" cy="32" r="30" stroke="var(--color-danger)" strokeWidth="2" opacity="0.3" />
        <path d="M32 20v14" stroke="var(--color-danger)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="42" r="2" fill="var(--color-danger)" />
      </svg>

      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
        {t.errors.generic}
      </div>

      {message && (
        <div style={{
          fontSize: 14,
          color: 'var(--tg-theme-hint-color)',
          marginBottom: 20,
          maxWidth: 280,
          lineHeight: 1.5,
        }}>
          {message}
        </div>
      )}

      {onRetry && (
        <button className="btn-primary" style={{ maxWidth: 200 }} onClick={onRetry}>
          {t.errors.retry}
        </button>
      )}
    </div>
  )
}
