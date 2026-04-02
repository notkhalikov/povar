import { useHaptic } from '../hooks/useHaptic'

interface StarRatingProps {
  value: number
  max?: number
  interactive?: boolean
  onChange?: (v: number) => void
  size?: number
}

export function StarRating({
  value,
  max = 5,
  interactive = false,
  onChange,
  size = 22,
}: StarRatingProps) {
  const haptic = useHaptic()

  return (
    <div style={{ display: 'flex', gap: interactive ? 4 : 1, alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          type='button'
          onClick={interactive && onChange ? () => { haptic.light(); onChange(n) } : undefined}
          style={{
            fontSize: size,
            lineHeight: 1,
            background: 'none',
            border: 'none',
            padding: interactive ? '6px 4px' : 0,
            cursor: interactive ? 'pointer' : 'default',
            color: '#f5a623',
            opacity: n <= value ? 1 : 0.25,
            minWidth: interactive ? 44 : undefined,
            minHeight: interactive ? 44 : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={interactive ? `Оценка ${n}` : undefined}
        >
          ★
        </button>
      ))}
    </div>
  )
}
