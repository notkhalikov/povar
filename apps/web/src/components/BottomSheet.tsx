import { useEffect } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          background: 'var(--tg-theme-bg-color)',
          borderRadius: '20px 20px 0 0',
          padding: '8px 16px max(24px, env(safe-area-inset-bottom))',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--sheet-shadow)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--tg-theme-hint-color)',
          opacity: .35,
          margin: '8px auto 16px',
        }} />

        {title && (
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>{title}</h3>
        )}

        {children}
      </div>
    </div>
  )
}
