import { useAuth } from '../components/AuthProvider'

export default function SplashPage() {
  const { loading, authError } = useAuth()

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      padding: '32px 24px',
      textAlign: 'center',
      position: 'relative',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: '#FEF0EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
      }}>
        <span style={{ fontSize: 40 }}>🍳</span>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
        Povarissimo
      </h1>

      {loading && (
        <p style={{ color: '#aaa', fontSize: 14 }}>Загрузка...</p>
      )}

      {authError === 'no_telegram' && (
        <>
          <p style={{ color: '#1a1a1a', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Откройте в Telegram
          </p>
          <p style={{ color: '#aaa', fontSize: 14, marginBottom: 24 }}>
            Приложение работает только внутри Telegram
          </p>
          <a
            href="https://t.me/povarissimobot"
            style={{
              display: 'inline-block',
              backgroundColor: '#2AABEE',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Открыть в Telegram
          </a>
        </>
      )}

      {authError === 'fetch_failed' && (
        <>
          <p style={{ color: '#D85A30', fontSize: 15, marginBottom: 8 }}>
            Не удалось войти
          </p>
          <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>
            Проверьте соединение и попробуйте снова
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#D85A30',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
        </>
      )}

      <p style={{ position: 'absolute', bottom: 24, color: '#ccc', fontSize: 12 }}>
        @povarissimobot
      </p>
    </div>
  )
}
