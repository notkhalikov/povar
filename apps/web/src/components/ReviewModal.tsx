import { useState } from 'react'

interface ReviewModalProps {
  orderId: number
  chefName: string
  onClose: () => void
  onSubmitted: () => void
}

export function ReviewModal({ orderId, chefName, onClose, onSubmitted }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (rating === 0) return
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${import.meta.env.VITE_API_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, rating, text: comment || undefined }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to submit review')
      }

      setLoading(false)
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting review')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 40px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#1A1917' }}>
          Оставить отзыв
        </h2>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>{chefName}</p>

        {/* Star rating */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              style={{
                fontSize: 36,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                opacity: star <= rating ? 1 : 0.3,
                transition: 'opacity 0.15s',
              }}
            >
              ⭐
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Расскажите о своём опыте..."
          style={{
            width: '100%',
            minHeight: 100,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1.5px solid #E8E6E1',
            fontSize: 15,
            resize: 'none',
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 16,
            fontFamily: 'inherit',
          }}
        />

        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#FFF5F2',
              borderRadius: 8,
              borderLeft: '3px solid #D85A30',
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 12, color: '#D85A30', margin: 0 }}>⚠️ {error}</p>
          </div>
        )}

        <button
          onClick={submit}
          disabled={rating === 0 || loading}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: rating === 0 ? '#ccc' : '#D85A30',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 600,
            cursor: rating === 0 ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Отправка...' : 'Отправить отзыв'}
        </button>
      </div>
    </div>
  )
}
