import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { useT } from '../i18n'
import { getChef, getChefReviews, chefPhotoUrl } from '../api/chefs'
import { reportReview, replyToReview } from '../api/reviews'
import { useAuth } from '../context/AuthContext'
import { StarRating } from '../components/StarRating'
import type { ChefProfile, ReviewItem } from '../types'

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#C89FE0', '#F4A261', '#52B788', '#E76F51',
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase() || '?'
}
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

export default function ChefPage() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [chef, setChef]       = useState<ChefProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [replyingTo, setReplyingTo]   = useState<number | null>(null)
  const [replyText, setReplyText]     = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    if (!id) return
    getChef(Number(id))
      .then(setChef)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    getChefReviews(Number(id), { limit: 5 })
      .then(res => setReviews(res.data))
      .catch(() => {})
  }, [id])

  async function handleReport(reviewId: number) {
    try {
      await reportReview(reviewId)
      WebApp.showAlert(t.chef.reportSuccess)
    } catch { WebApp.showAlert(t.chef.reportError) }
  }

  async function handleReply(reviewId: number) {
    if (!replyText.trim()) return
    setSendingReply(true)
    try {
      const updated = await replyToReview(reviewId, replyText.trim())
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, chefReply: updated.chefReply } : r))
      setReplyingTo(null)
      setReplyText('')
    } catch { WebApp.showAlert(t.chef.replyError) }
    finally { setSendingReply(false) }
  }

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
        <div className='sk' style={{ width: 88, height: 88, borderRadius: 44 }} />
        <div className='sk' style={{ height: 22, width: 160, borderRadius: 8 }} />
        <div className='sk' style={{ height: 16, width: 100, borderRadius: 8 }} />
      </div>
    </div>
  )
  if (error) return <div style={{ padding: 24, color: 'var(--color-danger)' }}>Ошибка: {error}</div>
  if (!chef) return null

  const rating = Number(chef.ratingCache)
  const isOwnProfile = user?.id === chef.userId

  // Badges
  const badges: { label: string; color: string; bg: string }[] = []
  if (chef.verificationStatus === 'approved') badges.push({ label: t.chef.badgeVerified, color: '#34c759', bg: '#34c75922' })
  if (rating >= 4.5 && chef.ordersCount >= 10)  badges.push({ label: t.chef.badgeTop,      color: '#f5a623', bg: '#f5a62322' })
  if (chef.ordersCount < 5)                      badges.push({ label: t.chef.badgeNew,      color: '#007aff', bg: '#007aff22' })

  return (
    <div style={{ paddingBottom: 'var(--page-padding-bottom-bar)' }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className='chef-hero' style={{ background: 'var(--tg-theme-secondary-bg-color)' }}>
        <div className='chef-avatar-lg' style={{ background: avatarColor(chef.name) }}>
          {chef.portfolioMediaIds.length > 0
            ? <img src={chefPhotoUrl(chef.id, chef.portfolioMediaIds[0])} alt={chef.name}
                style={{ width: '100%', height: '100%', borderRadius: 44, objectFit: 'cover' }} />
            : initials(chef.name)
          }
        </div>

        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>{chef.name}</h1>

        {chef.city && (
          <div style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)', marginBottom: 10 }}>
            📍 {chef.city}
          </div>
        )}

        {/* Rating row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <StarRating value={Math.round(rating)} size={20} />
          <span style={{ fontSize: 18, fontWeight: 700 }}>
            {rating > 0 ? rating.toFixed(1) : '—'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--tg-theme-hint-color)' }}>
            · {chef.ordersCount} {plural(chef.ordersCount, t.chef.ordersCount.one, t.chef.ordersCount.few, t.chef.ordersCount.many)}
          </span>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {badges.map(b => (
              <span key={b.label} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: b.bg, color: b.color,
              }}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* ── Portfolio horizontal scroll ───────────────────────── */}
        {chef.portfolioMediaIds.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <div className='section-label'>{t.chef.portfolio}</div>
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
              WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
            }}>
              {chef.portfolioMediaIds.map(fileId => (
                <img
                  key={fileId}
                  src={chefPhotoUrl(chef.id, fileId)}
                  alt='portfolio'
                  style={{
                    width: 140, height: 140, borderRadius: 12,
                    objectFit: 'cover', flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Bio ──────────────────────────────────────────────────── */}
        {chef.bio && (
          <section className='card' style={{ marginBottom: 12 }}>
            <div className='section-label'>{t.chef.about}</div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--tg-theme-text-color)' }}>
              {chef.bio}
            </p>
          </section>
        )}

        {/* ── Cuisine tags ──────────────────────────────────────── */}
        {chef.cuisineTags.length > 0 && (
          <section className='card' style={{ marginBottom: 12 }}>
            <div className='section-label'>{t.chef.cuisine}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {chef.cuisineTags.map(tag => (
                <span key={tag} className='tag-cuisine'>{tag}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── Work formats ─────────────────────────────────────── */}
        {chef.workFormats.length > 0 && (
          <section className='card' style={{ marginBottom: 12 }}>
            <div className='section-label'>{t.chef.workFormat}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {chef.workFormats.map(f => (
                <div key={f} style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--tg-theme-bg-color)',
                  fontSize: 14, fontWeight: 500,
                }}>
                  {f === 'home_visit' ? t.chef.homeVisitFull : t.chef.deliveryFull}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Districts ────────────────────────────────────────── */}
        {chef.districts.length > 0 && (
          <section className='card' style={{ marginBottom: 12 }}>
            <div className='section-label'>{t.chef.districts}</div>
            <div style={{ fontSize: 14, color: 'var(--tg-theme-text-color)', lineHeight: 1.6 }}>
              {chef.districts.join(', ')}
            </div>
          </section>
        )}

        {/* ── Avg price ────────────────────────────────────────── */}
        {chef.avgPrice && (
          <section className='card' style={{ marginBottom: 12 }}>
            <div className='section-label'>{t.chef.avgPrice}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{t.common.from} {chef.avgPrice} {t.common.currency}</div>
          </section>
        )}

        {/* ── Reviews ──────────────────────────────────────────── */}
        {reviews.length > 0 && (
          <section style={{ marginBottom: 12 }}>
            <div className='section-label'>{t.chef.reviews} ({reviews.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map(review => (
                <div key={review.id} className='card'>
                  {/* Author + stars */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{review.authorName}</span>
                    <StarRating value={review.rating} size={14} />
                  </div>

                  {/* Quality tags */}
                  {review.tagsQuality.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {review.tagsQuality.map(tag => (
                        <span key={tag} style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11,
                          background: 'var(--tg-theme-bg-color)',
                          color: 'var(--tg-theme-hint-color)',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {review.text && (
                    <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.5 }}>
                      {review.text}
                    </p>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--tg-theme-hint-color)' }}>
                    {new Date(review.createdAt).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </div>

                  {/* Chef reply */}
                  {review.chefReply && (
                    <div style={{
                      marginTop: 10, padding: '8px 10px', borderRadius: 8,
                      background: 'var(--tg-theme-bg-color)', fontSize: 13,
                      borderLeft: '3px solid var(--tg-theme-button-color)',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--tg-theme-hint-color)', marginBottom: 4 }}>
                        {t.chef.chefReply}
                      </div>
                      {review.chefReply}
                    </div>
                  )}

                  {/* Reply button (own profile, no reply yet) */}
                  {isOwnProfile && !review.chefReply && replyingTo !== review.id && (
                    <button
                      style={{
                        marginTop: 8, fontSize: 12, color: 'var(--tg-theme-button-color)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        minHeight: 44, display: 'flex', alignItems: 'center',
                      }}
                      onClick={() => { setReplyingTo(review.id); setReplyText('') }}
                    >
                      {t.chef.replyBtn}
                    </button>
                  )}

                  {/* Inline reply form */}
                  {isOwnProfile && replyingTo === review.id && (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        className='field-input'
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder='Ваш ответ…'
                        rows={2}
                        maxLength={2000}
                        style={{ resize: 'vertical', marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className='btn-secondary' style={{ flex: 1, padding: '9px' }}
                          onClick={() => setReplyingTo(null)} disabled={sendingReply}>
                          {t.common.cancel}
                        </button>
                        <button className='btn-primary' style={{ flex: 2, padding: '9px', opacity: sendingReply ? .6 : 1 }}
                          onClick={() => handleReply(review.id)} disabled={sendingReply}>
                          {sendingReply ? t.chef.replySaving : t.chef.replySave}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Report */}
                  {!isOwnProfile && (
                    <button
                      style={{
                        marginTop: 6, fontSize: 11, color: 'var(--tg-theme-hint-color)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        minHeight: 44, display: 'flex', alignItems: 'center',
                      }}
                      onClick={() => handleReport(review.id)}
                    >
                      {t.chef.reportBtn}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Sticky order button ───────────────────────────────────── */}
      <div className='action-bar'>
        <button
          className='btn-primary'
          onClick={() => navigate(`/orders/new?chefId=${chef.id}`)}
        >
          {t.chef.orderBtn} {chef.name.split(' ')[0]}
        </button>
      </div>
    </div>
  )
}
