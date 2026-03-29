import { useTelegram } from '../hooks/useTelegram'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user: tgUser } = useTelegram()
  const { user: apiUser } = useAuth()

  return (
    <div style={{ padding: '24px 16px' }}>
      <h2 style={{ margin: '0 0 20px' }}>Профиль</h2>

      <div style={sectionStyle}>
        <Row label='Имя' value={tgUser?.first_name ?? '—'} />
        {tgUser?.last_name && <Row label='Фамилия' value={tgUser.last_name} />}
        {tgUser?.username && <Row label='Username' value={`@${tgUser.username}`} />}
        <Row
          label='Роль'
          value={
            apiUser?.role === 'chef'
              ? '👨‍🍳 Повар'
              : apiUser?.role === 'admin'
              ? '🛡 Администратор'
              : '🛒 Заказчик'
          }
        />
      </div>

      {apiUser?.role === 'chef' && (
        <div style={{ marginTop: 24 }}>
          <button
            style={buttonStyle}
            onClick={() =>
              window.alert('Редактирование анкеты появится в следующей версии')
            }
          >
            Редактировать анкету
          </button>
        </div>
      )}

      {!apiUser && (
        <p style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14, marginTop: 16 }}>
          Откройте приложение через Telegram для авторизации
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--tg-theme-hint-color)' }}>
      <span style={{ color: 'var(--tg-theme-hint-color)', fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{value}</span>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--tg-theme-secondary-bg-color)',
  borderRadius: 12,
  padding: '0 16px',
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
