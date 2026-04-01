import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getChef, getChefReviews, chefPhotoUrl } from '../api/chefs'
import { reportReview, replyToReview } from '../api/reviews'
import { useAuth } from '../context/AuthContext'
import type { ChefProfile, ReviewItem } from '../types'

export default function ChefPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [chef, setChef] = useState<ChefProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Stable callback ref so offClick can remove the correct listener
  const goBack = useCallback(() => navigate(-1), [navigate])

  // Telegram BackButton
  useEffect(() => {
    WebApp.BackButton.show()
    WebApp.BackButton.onClick(goBack)
    return () => {
      WebApp.BackButton.hide()
      WebApp.BackButton.offClick(goBack)
    }
  }, [goBack])

  useEffect(() => {
    if (!id) return
    getChef(Number(id))
      .then(setChef)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    getChefReviews(Number(id), { limit: 5 })
      .then(res => setReviews(res.data))
      .catch(() => {}) // reviews are non-critical
  }, [id])

  async function handleReport(reviewId: number) {
    try {
      await reportReview(reviewId)
      WebApp.showAlert('Отзыв отправлен на проверку. Спасибо!')
    } catch {
      WebApp.showAlert('Не удалось отправить жалобу')
    }
  }

  async function handleReply(reviewId: number) {
    if (!replyText.trim()) return
    setSendingReply(true)
    try {
      const updated = await replyToReview(reviewId, replyText.trim())
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, chefReply: updated.chefReply } : r))
      setReplyingTo(null)
      setReplyText('')
    } catch {
      WebApp.showAlert('Не удалось сохранить ответ')
    } finally {
      setSendingReply(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  }
  if (error) {
    return <div style={{ padding: 24, color: 'red' }}>Ошибка: {error}</div>
  }
  if (!chef) return null

  const rating = Number(chef.ratingCache)
  const isOwnProfile = user?.id === chef.userId

  return (
    <div style={{ padding: '12px 16px', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>{chef.name}</h2>
        {chef.city && (
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>
            📍 {chef.city}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 14 }}>
          <span>★ {rating > 0 ? rating.toFixed(1) : '—'}</span>
          <span style={{ color: 'var(--tg-theme-hint-color)' }}>
            {chef.ordersCount} {plural(chef.ordersCount, 'заказ', 'заказа', 'заказов')}
          </span>
        </div>
      </div>

      {/* Bio */}
      {chef.bio && (
        <section style={sectionStyle}>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 15 }}>{chef.bio}</p>
        </section>
      )}

      {/* Cuisine tags */}
      {chef.cuisineTags.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Кухня</SectionLabel>
          <div style={tagsRow}>
            {chef.cuisineTags.map(tag => (
              <span key={tag} style={cuisineTagStyle}>{tag}</span>
            ))}
          </div>
        </section>
      )}

      {/* Work formats */}
      {chef.workFormats.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Формат работы</SectionLabel>
          <div style={tagsRow}>
            {chef.workFormats.map(f => (
              <span key={f} style={formatTagStyle}>
                {f === 'home_visit' ? '🏠 Повар на дом' : '🚚 Доставка'}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Districts */}
      {chef.districts.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Районы</SectionLabel>
          <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>
            {chef.districts.join(', ')}
          </div>
        </section>
      )}

      {/* Average price */}
      {chef.avgPrice && (
        <section style={sectionStyle}>
          <SectionLabel>Средний чек</SectionLabel>
          <div style={{ fontSize: 20, fontWeight: 600 }}>от {chef.avgPrice} ₾</div>
        </section>
      )}

      {/* Portfolio */}
      {chef.portfolioMediaIds.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Портфолио</SectionLabel>
          <div style={portfolioScrollStyle}>
            {chef.portfolioMediaIds.map(fileId => (
              <img
                key={fileId}
                src={chefPhotoUrl(chef.id, fileId)}
                alt='portfolio'
                style={portfolioImgStyle}
              />
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section style={sectionStyle}>
          <SectionLabel>Отзывы</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(review => (
              <div key={review.id} style={reviewCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{review.authorName}</span>
                  <span style={{ color: '#f5a623', fontSize: 14 }}>
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                  </span>
                </div>
                {review.tagsQuality.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {review.tagsQuality.map(tag => (
                      <span key={tag} style={reviewTagStyle}>{tag}</span>
                    ))}
                  </div>
                )}
                {review.text && (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--tg-theme-text-color)' }}>
                    {review.text}
                  </p>
                )}
                <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)', marginTop: 6 }}>
                  {new Date(review.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                {/* Chef reply */}
                {review.chefReply && (
                  <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--tg-theme-bg-color)', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--tg-theme-hint-color)' }}>Ответ повара: </span>
                    {review.chefReply}
                  </div>
                )}

                {/* Chef: inline reply form */}
                {isOwnProfile && !review.chefReply && replyingTo !== review.id && (
                  <button
                    style={{ marginTop: 8, fontSize: 12, color: 'var(--tg-theme-link-color)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => { setReplyingTo(review.id); setReplyText('') }}
                  >
                    Ответить
                  </button>
                )}
                {isOwnProfile && replyingTo === review.id && (
                  <div style={{ marginTop: 8 }}>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder='Ваш ответ на отзыв…'
                      rows={2}
                      maxLength={2000}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--tg-theme-hint-color)', background: 'var(--tg-theme-secondary-bg-color)', color: 'var(--tg-theme-text-color)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button
                        style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid var(--tg-theme-hint-color)', background: 'transparent', color: 'var(--tg-theme-text-color)', fontSize: 13, cursor: 'pointer' }}
                        onClick={() => setReplyingTo(null)}
                        disabled={sendingReply}
                      >
                        Отмена
                      </button>
                      <button
                        style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: sendingReply ? 0.6 : 1 }}
                        onClick={() => handleReply(review.id)}
                        disabled={sendingReply}
                      >
                        {sendingReply ? 'Сохраняем…' : 'Сохранить'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Customer: report button */}
                {!isOwnProfile && (
                  <button
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--tg-theme-hint-color)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => handleReport(review.id)}
                  >
                    Пожаловаться
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Order CTA — Stage 2 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'var(--tg-theme-bg-color)', borderTop: '1px solid var(--tg-theme-hint-color)' }}>
        <button
          style={buttonStyle}
          onClick={() => navigate(`/orders/new?chefId=${chef.id}`)}
        >
          Заказать
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: 'var(--tg-theme-hint-color)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
}

const tagsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const cuisineTagStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 20,
  fontSize: 13,
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
}

const formatTagStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 20,
  fontSize: 13,
  background: 'var(--tg-theme-secondary-bg-color)',
  color: 'var(--tg-theme-text-color)',
  border: '1px solid var(--tg-theme-hint-color)',
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--tg-theme-button-color)',
  color: 'var(--tg-theme-button-text-color)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
}

const reviewCardStyle: React.CSSProperties = {
  padding: '14px',
  borderRadius: 12,
  background: 'var(--tg-theme-secondary-bg-color)',
}

const reviewTagStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 12,
  background: 'var(--tg-theme-hint-color)22',
  color: 'var(--tg-theme-hint-color)',
}

const portfolioScrollStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  overflowX: 'auto',
  paddingBottom: 4,
  scrollbarWidth: 'none',
}

const portfolioImgStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 140,
  height: 140,
  objectFit: 'cover',
  borderRadius: 12,
}
