import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { useT } from '../i18n'
import { getChef, getChefReviews, chefPhotoUrl } from '../api/chefs'
import { reportReview, replyToReview } from '../api/reviews'
import { useAuth } from '../components/AuthProvider'
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
  if (error) return <div style={{ padding: 24, color: '#E24B4A' }}>{t.common.error}: {error}</div>
  if (!chef) return null

  const rating = Number(chef.ratingCache)
  const isOwnProfile = user?.id === chef.userId

  // Badges
  const badges: { label: string; color: string; bg: string }[] = []
  if (chef.verificationStatus === 'approved') badges.push({ label: t.chef.badgeVerified, color: '#007aff', bg: '#007aff22' })
  if (rating >= 4.8 && chef.ordersCount >= 10)  badges.push({ label: t.chef.badgeTop,    color: '#f5a623', bg: '#f5a62322' })
  if (chef.ordersCount < 3)                      badges.push({ label: t.chef.badgeNew,    color: '#8e8e93', bg: '#8e8e9322' })

  return (
    <div style={{ backgroundColor: '#F7F6F3', minHeight: '100%' }}>

      {/* ШАПКА */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E8E6E1',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#6B6966', fontSize: 15, cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 5L8 10l5 5" stroke="#6B6966" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
      </div>

      {/* ПРОФИЛЬ */}
      <div style={{ backgroundColor: '#ffffff', padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>

          {/* Аватар */}
          <div style={{
            width: 76, height: 76, borderRadius: 16, flexShrink: 0,
            backgroundColor: avatarColor(chef.name),
            backgroundImage: chef.portfolioMediaIds.length > 0 ? `url(${chefPhotoUrl(chef.id, chef.portfolioMediaIds[0])})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 500, color: '#ffffff',
          }}>
            {chef.portfolioMediaIds.length === 0 && initials(chef.name)}
          </div>

          {/* Имя и кухня */}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1A1917', margin: '0 0 4px' }}>
              {chef.name}
            </h1>
            <p style={{ fontSize: 13, color: '#6B6966', margin: '0 0 12px' }}>
              {chef.cuisineTags.slice(0, 2).join(', ')} {chef.cuisineTags.length > 2 ? '...' : ''} {chef.city ? `· ${chef.city}` : ''}
            </p>

            {/* Статистика */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {[
                { value: rating > 0 ? rating.toFixed(1) : '—', label: 'рейтинг' },
                { value: chef.ordersCount ?? 0, label: 'заказов' },
              ].map((stat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  {i > 0 && (
                    <div style={{ width: 1, height: 28, backgroundColor: '#E8E6E1', margin: '0 12px' }} />
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: '#1A1917' }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 10, color: '#9E9B97' }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Теги верификации */}
        {chef.verificationStatus === 'approved' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6,
              backgroundColor: '#C0DD97', color: '#3B6D11',
            }}>✓ Проверен</span>
            {rating >= 4.8 && chef.ordersCount >= 10 && (
              <span style={{
                fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6,
                backgroundColor: '#FAEEDA', color: '#854F0B',
              }}>Топ</span>
            )}
          </div>
        )}
      </div>

      {/* О СЕБЕ */}
      {chef.bio && (
        <div style={{
          backgroundColor: '#ffffff', margin: '8px 0',
          padding: '16px 16px',
          borderTop: '1px solid #E8E6E1', borderBottom: '1px solid #E8E6E1',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1917', margin: '0 0 8px' }}>
            О себе
          </p>
          <p style={{ fontSize: 14, color: '#6B6966', lineHeight: 1.6, margin: 0 }}>
            {chef.bio}
          </p>
        </div>
      )}

      {/* ПОРТФОЛИО */}
      {chef.portfolioMediaIds.length > 0 && (
        <div style={{
          backgroundColor: '#ffffff', margin: '8px 0',
          padding: '16px 16px',
          borderTop: '1px solid #E8E6E1', borderBottom: '1px solid #E8E6E1',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1917', margin: '0 0 12px' }}>
            Портфолио
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {chef.portfolioMediaIds.map((fileId: string, i: number) => (
              <div key={i} style={{
                aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
                backgroundColor: '#FAECE7',
              }}>
                <img src={chefPhotoUrl(chef.id, fileId)} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ЦЕНА */}
      {chef.avgPrice && (
        <div style={{
          backgroundColor: '#ffffff', margin: '8px 0',
          padding: '14px 16px',
          borderTop: '1px solid #E8E6E1', borderBottom: '1px solid #E8E6E1',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 14, color: '#6B6966' }}>Стоимость</span>
          <span style={{ fontSize: 17, fontWeight: 500, color: '#D85A30' }}>
            от {chef.avgPrice} ₾
          </span>
        </div>
      )}

      {/* ОТЗЫВЫ */}
      {reviews.length > 0 && (
        <div style={{
          backgroundColor: '#ffffff', margin: '8px 0',
          padding: '16px 16px',
          borderTop: '1px solid #E8E6E1', borderBottom: '1px solid #E8E6E1',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1917', margin: '0 0 12px' }}>
            Отзывы ({reviews.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reviews.map(review => (
              <div key={review.id} style={{
                padding: 12, backgroundColor: '#F7F6F3', borderRadius: 12,
              }}>
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
                        background: '#ffffff',
                        color: '#6B6966',
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

                <div style={{ fontSize: 11, color: '#9E9B97' }}>
                  {new Date(review.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </div>

                {/* Chef reply */}
                {review.chefReply && (
                  <div style={{
                    marginTop: 10, padding: '8px 10px', borderRadius: 8,
                    background: '#ffffff', fontSize: 13,
                    borderLeft: '3px solid #D85A30',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#6B6966', marginBottom: 4 }}>
                      Ответ повара
                    </div>
                    {review.chefReply}
                  </div>
                )}

                {/* Reply button (own profile, no reply yet) */}
                {isOwnProfile && !review.chefReply && replyingTo !== review.id && (
                  <button
                    style={{
                      marginTop: 8, fontSize: 12, color: '#D85A30',
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
                      placeholder={t.chef.chefReply + '…'}
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
                      marginTop: 6, fontSize: 11, color: '#9E9B97',
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
        </div>
      )}

      {/* CTA КНОПКА */}
      <div style={{ padding: '16px 16px' }}>
        <button
          onClick={() => navigate(`/orders/new?chefId=${chef.id}`)}
          disabled={chef.isOnVacation}
          style={{
            width: '100%', padding: 14,
            borderRadius: 12, border: 'none',
            backgroundColor: chef.isOnVacation ? '#D0CEC9' : '#D85A30',
            color: '#ffffff', fontSize: 16, fontWeight: 500,
            cursor: chef.isOnVacation ? 'not-allowed' : 'pointer',
          }}
        >
          {chef.isOnVacation ? 'Повар сейчас в отпуске' : `Оставить заявку ${chef.name.split(' ')[0]}`}
        </button>
      </div>
    </div>
  )
}
