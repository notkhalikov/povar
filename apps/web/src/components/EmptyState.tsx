import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  subtitle?: string
  illustration?: ReactNode
  action?: ReactNode
}

function DefaultIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="36" fill="var(--tg-theme-secondary-bg-color)" />
      <path
        d="M26 52c0-7.732 6.268-14 14-14s14 6.268 14 14"
        stroke="var(--tg-theme-hint-color)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="32" cy="34" r="3" fill="var(--tg-theme-hint-color)" opacity="0.5" />
      <circle cx="48" cy="34" r="3" fill="var(--tg-theme-hint-color)" opacity="0.5" />
    </svg>
  )
}

export function EmptyState({ title, subtitle, illustration, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: 16 }}>
        {illustration ?? <DefaultIllustration />}
      </div>

      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: subtitle ? 8 : 0 }}>
        {title}
      </div>

      {subtitle && (
        <div style={{
          fontSize: 14,
          color: 'var(--tg-theme-hint-color)',
          maxWidth: 280,
          lineHeight: 1.5,
          marginBottom: action ? 20 : 0,
        }}>
          {subtitle}
        </div>
      )}

      {action}
    </div>
  )
}
