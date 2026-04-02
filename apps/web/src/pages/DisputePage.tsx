import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { getDispute } from '../api/disputes'
import type { Dispute, DisputeStatus } from '../types'
import { useT } from '../i18n'

const STATUS_COLORS: Record<DisputeStatus, string> = {
  open:                 '#ff3b30',
  awaiting_other_party: '#e67e00',
  support_review:       '#007aff',
  resolved:             '#34c759',
}

export default function DisputePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const goBack = useCallback(() => navigate(-1), [navigate])

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
    getDispute(Number(id))
      .then(setDispute)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--tg-theme-hint-color)' }}>Загрузка…</div>
  if (error)   return <div style={{ padding: 24, color: 'red' }}>Ошибка: {error}</div>
  if (!dispute) return null

  const statusColor = STATUS_COLORS[dispute.status]

  return (
    <div style={{ padding: '16px 16px 40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Спор #{dispute.id}</h2>
        <span style={{
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 600,
          background: statusColor + '22',
          color: statusColor,
          border: `1px solid ${statusColor}44`,
        }}>
          {STATUS_LABELS[dispute.status]}
        </span>
      </div>

      {/* Pending notice */}
      {dispute.status !== 'resolved' && (
        <div style={noticeBannerStyle}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>⏳</div>
          <div style={{ fontSize: 14 }}>
            Спор рассматривается службой поддержки. Обычно это занимает 24–48 часов.
          </div>
        </div>
      )}

      {/* Resolution block */}
      {dispute.status === 'resolved' && dispute.resolutionType && (
        <div style={resolutionBannerStyle}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>⚖️</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            {RESOLUTION_LABELS[dispute.resolutionType]}
          </div>
          {dispute.resolutionComment && (
            <div style={{ fontSize: 14, color: 'var(--tg-theme-hint-color)' }}>
              {dispute.resolutionComment}
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div style={sectionStyle}>
        <Row label='Заказ'>#{dispute.orderId}</Row>
        <Row label='Открыт'>{dispute.openedBy === 'customer' ? 'Заказчиком' : 'Поваром'}</Row>
        <Row label='Причина'>{REASON_LABELS[dispute.reasonCode] ?? dispute.reasonCode}</Row>
        <Row label='Дата'>
          {new Date(dispute.createdAt).toLocaleString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Row>
      </div>

      {/* Description */}
      {dispute.description && (
        <div style={{ marginTop: 20 }}>
          <div style={labelStyle}>Описание проблемы</div>
          <div style={{ ...sectionStyle, padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{dispute.description}</p>
          </div>
        </div>
      )}

      {/* Back to order link */}
      <button
        style={backLinkStyle}
        onClick={() => navigate(`/orders/${dispute.orderId}`)}
      >
        ← Вернуться к заказу #{dispute.orderId}
      </button>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--tg-theme-hint-color)22' }}>
      <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{children}</span>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: 'var(--tg-theme-secondary-bg-color)',
  borderRadius: 12,
  padding: '0 16px',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--tg-theme-hint-color)',
  marginBottom: 8,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}

const noticeBannerStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: 12,
  background: '#007aff11',
  border: '1px solid #007aff33',
  textAlign: 'center',
  marginBottom: 20,
}

const resolutionBannerStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: 12,
  background: '#34c75911',
  border: '1px solid #34c75933',
  textAlign: 'center',
  marginBottom: 20,
}

const backLinkStyle: React.CSSProperties = {
  marginTop: 28,
  display: 'block',
  width: '100%',
  padding: '12px',
  borderRadius: 12,
  border: '1px solid var(--tg-theme-hint-color)',
  background: 'transparent',
  color: 'var(--tg-theme-text-color)',
  fontSize: 15,
  cursor: 'pointer',
  textAlign: 'center',
}
